import { PrismaClient } from '@recruitflow/database';
import { Queue, Worker as BullWorker } from 'bullmq';
import IORedis from 'ioredis';
import { createOutboxProcessor } from './processor';
import { assertOutboxEncryptionKey } from './outbox-crypto';
import { createTransportFromEnv } from './transport';

const BATCH_SIZE = positiveInt(process.env.WORKER_BATCH_SIZE, 20, 100);
const POLL_INTERVAL_MS = positiveInt(process.env.WORKER_POLL_INTERVAL_MS, 2_000, 60_000);
const IDLE_DELAY_MS = 250;
const QUEUE_NAME = 'recruitflow-email-outbox';

const prisma = new PrismaClient();
const transport = createTransportFromEnv(process.env);
const processBatch = createOutboxProcessor(prisma, transport);

let stopping = false;

interface BullRuntime {
  queue: Queue;
  worker: BullWorker;
  connection: IORedis;
}

async function main(): Promise<void> {
  assertOutboxEncryptionKey();
  const bullRuntime = await startBullRuntime();
  console.log(
    `[worker] email outbox drain started — transport=${transport.name}, batch=${BATCH_SIZE}, poll=${POLL_INTERVAL_MS}ms, scheduler=${bullRuntime ? 'bullmq' : 'db-poll-fallback'}`,
  );

  await runPollingFallback();
  await bullRuntime?.worker.close();
  await bullRuntime?.queue.close();
  bullRuntime?.connection.disconnect();

  console.log('[worker] shutting down');
}

async function runPollingFallback(): Promise<void> {
  while (!stopping) {
    let processedAny = false;
    try {
      const result = await processBatch(BATCH_SIZE);
      processedAny = result.claimed > 0;
      if (result.retried > 0 || result.dead > 0) {
        console.log(`[worker] batch: sent=${result.sent} retried=${result.retried} dead=${result.dead}`);
      }
    } catch (err) {
      console.error(`[worker] loop error: ${err instanceof Error ? err.message : err}`);
    }

    await sleep(stopping ? 0 : processedAny ? IDLE_DELAY_MS : POLL_INTERVAL_MS);
  }
}

async function startBullRuntime(): Promise<BullRuntime | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 750,
    retryStrategy: () => null,
  });
  connection.on('error', (error) => {
    console.warn(`[worker] BullMQ Redis unavailable: ${error.message}`);
  });

  let queue: Queue | undefined;
  let worker: BullWorker | undefined;
  try {
    await connection.connect();
    queue = new Queue(QUEUE_NAME, { connection });
    await queue.waitUntilReady();
    worker = new BullWorker(
      QUEUE_NAME,
      async () => {
        const result = await processBatch(BATCH_SIZE);
        if (result.retried > 0 || result.dead > 0) {
          console.log(`[worker] BullMQ drain: sent=${result.sent} retried=${result.retried} dead=${result.dead}`);
        }
        return result;
      },
      {
        connection,
        concurrency: 1,
        autorun: true,
      },
    );
    worker.on('error', (error) => console.error(`[worker] BullMQ error: ${error.message}`));
    await worker.waitUntilReady();
    await queue.upsertJobScheduler(
      'email-outbox-drain',
      { every: POLL_INTERVAL_MS },
      {
        name: 'drain',
        data: {},
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 }, removeOnComplete: true },
      },
    );
    return { queue, worker, connection };
  } catch (error) {
    console.warn(`[worker] BullMQ scheduler disabled; using DB polling fallback: ${error instanceof Error ? error.message : error}`);
    await worker?.close().catch(() => undefined);
    await queue?.close().catch(() => undefined);
    connection.disconnect();
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

main()
  .catch((err) => {
    console.error(`[worker] fatal: ${err instanceof Error ? err.stack ?? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw ?? fallback);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(max, parsed)) : fallback;
}
