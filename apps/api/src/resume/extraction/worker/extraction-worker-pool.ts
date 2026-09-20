import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Worker } from 'node:worker_threads';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { NormalizedResumeDocument } from '@recruitflow/contracts';
import {
  DocumentExtractionError,
  DEFAULT_EXTRACTION_LIMITS,
  type ScannedDocumentThresholds,
  type ExtractionLimits,
} from '../document-extractor.interface';
import type { ResumeSource } from '../../source/resume-source.interface';
export interface WorkerExtractRequest {
  type: 'EXTRACT';
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Uint8Array;
  thresholds?: ScannedDocumentThresholds | undefined;
  limits?: ExtractionLimits | undefined;
}

export interface WorkerExtractSuccessResponse {
  type: 'EXTRACT_SUCCESS';
  taskId: string;
  result: NormalizedResumeDocument;
}

export interface WorkerExtractFailureResponse {
  type: 'EXTRACT_FAILURE';
  taskId: string;
  error: {
    code: 'UNSUPPORTED_FORMAT' | 'CORRUPTED_FILE' | 'EXTRACTION_FAILED' | 'LIMIT_EXCEEDED';
    message: string;
  };
}

export type WorkerResponse = WorkerExtractSuccessResponse | WorkerExtractFailureResponse;

interface ActiveTask {
  taskId: string;
  resolve: (doc: NormalizedResumeDocument) => void;
  reject: (err: DocumentExtractionError) => void;
  timeoutTimer: NodeJS.Timeout;
  startTime: number;
}

interface QueuedTask {
  taskId: string;
  source: ResumeSource;
  thresholds?: ScannedDocumentThresholds | undefined;
  limits?: ExtractionLimits | undefined;
  resolve: (doc: NormalizedResumeDocument) => void;
  reject: (err: DocumentExtractionError) => void;
  enqueuedAt: number;
}

interface WorkerEntry {
  id: number;
  worker: Worker;
  currentTask: ActiveTask | null;
  isTerminating: boolean;
}

export interface ExtractionWorkerPoolOptions {
  poolSize?: number;
  maxMemoryMb?: number;
  maxQueueSize?: number;
  workerScriptPath?: string;
}

@Injectable()
export class ExtractionWorkerPool implements OnModuleDestroy {
  private readonly logger = new Logger(ExtractionWorkerPool.name);
  private readonly poolSize: number;
  private readonly maxMemoryMb: number;
  private readonly maxQueueSize: number;
  private readonly workerScriptPath: string;
  private readonly workers: WorkerEntry[] = [];
  private readonly queue: QueuedTask[] = [];
  private isShuttingDown = false;
  private nextWorkerId = 1;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional() options?: ExtractionWorkerPoolOptions,
  ) {
    const rawPoolSize = options?.poolSize ?? configService?.get<number | string>('DOCUMENT_EXTRACTOR_WORKER_POOL_SIZE');
    this.poolSize = Math.max(1, Number(rawPoolSize) || 2);

    const rawMaxMemory = options?.maxMemoryMb ?? configService?.get<number | string>('DOCUMENT_EXTRACTOR_WORKER_MAX_MEMORY_MB');
    this.maxMemoryMb = Math.max(32, Number(rawMaxMemory) || 256);

    const rawQueueSize = options?.maxQueueSize ?? configService?.get<number | string>('DOCUMENT_EXTRACTOR_WORKER_MAX_QUEUE_SIZE');
    this.maxQueueSize = Math.max(1, Number(rawQueueSize) || 20);

    if (options?.workerScriptPath) {
      this.workerScriptPath = options.workerScriptPath;
    } else {
      this.workerScriptPath = path.resolve(__dirname, 'document-extractor.worker.js');
    }

    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i += 1) {
      this.spawnWorker();
    }
    this.logger.log(`Initialized ExtractionWorkerPool with ${this.workers.length} workers (maxMemoryMb: ${this.maxMemoryMb}).`);
  }

  private spawnWorker(): WorkerEntry {
    const id = this.nextWorkerId++;

    const worker = new Worker(this.workerScriptPath, {
      resourceLimits: {
        maxOldGenerationSizeMb: this.maxMemoryMb,
        maxYoungGenerationSizeMb: Math.max(16, Math.floor(this.maxMemoryMb / 4)),
        codeRangeSizeMb: 32,
        stackSizeMb: 4,
      },
    });

    const entry: WorkerEntry = {
      id,
      worker,
      currentTask: null,
      isTerminating: false,
    };

    worker.on('message', (response: WorkerResponse) => {
      this.handleWorkerMessage(entry, response);
    });

    worker.on('error', (err: Error) => {
      this.handleWorkerError(entry, err);
    });

    worker.on('exit', (code: number) => {
      this.handleWorkerExit(entry, code);
    });

    this.workers.push(entry);
    return entry;
  }

  private handleWorkerMessage(entry: WorkerEntry, response: WorkerResponse): void {
    const task = entry.currentTask;
    if (!task || task.taskId !== response.taskId) return;

    clearTimeout(task.timeoutTimer);
    entry.currentTask = null;

    if (response.type === 'EXTRACT_SUCCESS') {
      task.resolve(response.result);
    } else {
      task.reject(
        new DocumentExtractionError(response.error.message, undefined, response.error.code),
      );
    }

    this.dispatchNext();
  }

  private handleWorkerError(entry: WorkerEntry, err: Error): void {
    this.logger.error(`Worker ${entry.id} encountered error: ${err.message}`);
    const task = entry.currentTask;
    entry.currentTask = null;

    if (task) {
      clearTimeout(task.timeoutTimer);
      const isOom =
        /out of memory/i.test(err.message) ||
        (err as { code?: string }).code === 'ERR_WORKER_OUT_OF_MEMORY';

      task.reject(
        new DocumentExtractionError(
          isOom
            ? 'Extraction limits exceeded: document parsing exceeded worker memory limit.'
            : `Extraction worker error: ${err.message}`,
          err,
          isOom ? 'LIMIT_EXCEEDED' : 'EXTRACTION_FAILED',
        ),
      );
    }

    if (!entry.isTerminating) {
      this.replaceWorker(entry);
    }
  }

  private handleWorkerExit(entry: WorkerEntry, code: number): void {
    if (code !== 0 && !entry.isTerminating) {
      this.logger.warn(`Worker ${entry.id} exited with non-zero code ${code}.`);
      const task = entry.currentTask;
      entry.currentTask = null;

      if (task) {
        clearTimeout(task.timeoutTimer);
        task.reject(
          new DocumentExtractionError(
            `Extraction worker terminated unexpectedly with exit code ${code}.`,
            undefined,
            'EXTRACTION_FAILED',
          ),
        );
      }

      if (!this.isShuttingDown) {
        this.replaceWorker(entry);
      }
    }
  }

  private replaceWorker(entry: WorkerEntry): void {
    entry.isTerminating = true;
    const index = this.workers.indexOf(entry);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    entry.worker.removeAllListeners();
    entry.worker.terminate().catch(() => {});

    if (!this.isShuttingDown) {
      this.spawnWorker();
      this.dispatchNext();
    }
  }

  async extract(
    source: ResumeSource,
    thresholds?: ScannedDocumentThresholds,
    limits?: ExtractionLimits,
  ): Promise<NormalizedResumeDocument> {
    if (this.isShuttingDown) {
      throw new DocumentExtractionError('Worker pool is shutting down', undefined, 'EXTRACTION_FAILED');
    }

    const taskId = crypto.randomUUID();

    return new Promise<NormalizedResumeDocument>((resolve, reject) => {
      const idleWorker = this.workers.find((w) => !w.currentTask && !w.isTerminating);

      if (idleWorker) {
        this.dispatchTask(idleWorker, {
          taskId,
          source,
          ...(thresholds !== undefined ? { thresholds } : {}),
          ...(limits !== undefined ? { limits } : {}),
          resolve,
          reject,
          enqueuedAt: Date.now(),
        });
      } else {
        if (this.queue.length >= this.maxQueueSize) {
          return reject(
            new DocumentExtractionError(
              `Extraction limits exceeded: worker pool queue full (${this.queue.length}/${this.maxQueueSize}).`,
              undefined,
              'LIMIT_EXCEEDED',
            ),
          );
        }

        this.queue.push({
          taskId,
          source,
          ...(thresholds !== undefined ? { thresholds } : {}),
          ...(limits !== undefined ? { limits } : {}),
          resolve,
          reject,
          enqueuedAt: Date.now(),
        });
      }
    });
  }

  private async dispatchTask(entry: WorkerEntry, queued: QueuedTask): Promise<void> {
    const { taskId, source, thresholds, limits, resolve, reject } = queued;
    const timeoutMs = limits?.timeoutMs ?? DEFAULT_EXTRACTION_LIMITS.timeoutMs;

    const timeoutTimer = setTimeout(async () => {
      this.logger.warn(`Worker ${entry.id} timed out after ${timeoutMs}ms. Initiating hard kill.`);
      entry.isTerminating = true;

      try {
        await entry.worker.terminate();
      } catch (termErr) {
        this.logger.error(`Failed to terminate worker ${entry.id}: ${termErr}`);
      }

      const currentTask = entry.currentTask;
      entry.currentTask = null;

      if (currentTask) {
        currentTask.reject(
          new DocumentExtractionError(
            `Extraction limits exceeded: extraction took longer than max timeout of ${timeoutMs}ms (hard thread termination).`,
            undefined,
            'LIMIT_EXCEEDED',
          ),
        );
      }

      this.replaceWorker(entry);
    }, timeoutMs);

    entry.currentTask = {
      taskId,
      resolve,
      reject,
      timeoutTimer,
      startTime: Date.now(),
    };

    try {
      const buffer = await source.binarySource.getBuffer();
      // Zero-copy transfer of underlying ArrayBuffer (or slice) to worker
      const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

      const request: WorkerExtractRequest = {
        type: 'EXTRACT',
        taskId,
        fileName: source.fileName,
        mimeType: source.mimeType,
        buffer: uint8,
        ...(thresholds !== undefined ? { thresholds } : {}),
        ...(limits !== undefined ? { limits } : {}),
      };

      entry.worker.postMessage(request);
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      entry.currentTask = null;
      const msg = err instanceof Error ? err.message : String(err);
      reject(new DocumentExtractionError(`Failed to prepare extraction buffer: ${msg}`, err, 'EXTRACTION_FAILED'));
      this.dispatchNext();
    }
  }

  private dispatchNext(): void {
    if (this.isShuttingDown || this.queue.length === 0) return;

    const idleWorker = this.workers.find((w) => !w.currentTask && !w.isTerminating);
    if (!idleWorker) return;

    const nextTask = this.queue.shift();
    if (nextTask) {
      this.dispatchTask(idleWorker, nextTask);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    // Drain queue
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      task?.reject(new DocumentExtractionError('Worker pool shut down', undefined, 'EXTRACTION_FAILED'));
    }

    // Terminate all active workers
    const terminationPromises = this.workers.map(async (entry) => {
      entry.isTerminating = true;
      if (entry.currentTask) {
        clearTimeout(entry.currentTask.timeoutTimer);
        entry.currentTask.reject(new DocumentExtractionError('Worker pool shut down', undefined, 'EXTRACTION_FAILED'));
        entry.currentTask = null;
      }
      entry.worker.removeAllListeners();
      try {
        await entry.worker.terminate();
      } catch {
        // ignore
      }
    });

    await Promise.all(terminationPromises);
    this.workers.length = 0;
    this.logger.log('ExtractionWorkerPool shut down successfully.');
  }

  /** Inspection helper for testing */
  get activeWorkerCount(): number {
    return this.workers.length;
  }

  /** Inspection helper for testing */
  get busyWorkerCount(): number {
    return this.workers.filter((w) => !!w.currentTask).length;
  }

  /** Inspection helper for testing */
  get queuedCount(): number {
    return this.queue.length;
  }
}
