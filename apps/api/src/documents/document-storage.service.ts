import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

@Injectable()
export class DocumentStorageService {
  private readonly provider = process.env.RECRUITFLOW_DOCUMENT_STORAGE_PROVIDER ?? 'local-private';

  getProvider(): string {
    return this.provider;
  }

  private ensureSupportedProvider(): void {
    if (this.provider !== 'local-private') {
      throw new ServiceUnavailableException(`Document storage provider ${this.provider} is not configured in this deployment.`);
    }
  }

  async put(organizationId: string, candidateId: string, fileName: string, buffer: Buffer): Promise<{ storageKey: string; provider: string }> {
    this.ensureSupportedProvider();
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200) || 'candidate-cv';
    const storageKey = path.posix.join(organizationId, candidateId, `${randomUUID()}-${safeName}`);
    const absolutePath = this.absolutePath(storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer, { flag: 'wx' });
    return { storageKey, provider: this.provider };
  }

  absolutePath(storageKey: string): string {
    this.ensureSupportedProvider();
    if (!storageKey || storageKey.startsWith('metadata-only/') || storageKey.includes('..') || storageKey.includes('\\')) {
      throw new ServiceUnavailableException('The document storage reference is invalid.');
    }
    const root = path.resolve(process.env.RECRUITFLOW_DOCUMENT_STORAGE_PATH ?? path.join(process.cwd(), 'storage', 'documents'));
    const absolutePath = path.resolve(root, storageKey);
    if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new ServiceUnavailableException('The document storage reference is outside the private root.');
    return absolutePath;
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await stat(this.absolutePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async remove(storageKey: string): Promise<void> {
    if (!storageKey || storageKey.startsWith('metadata-only/')) return;
    await unlink(this.absolutePath(storageKey)).catch(() => undefined);
  }
}
