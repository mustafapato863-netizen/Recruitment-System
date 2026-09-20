/**
 * Binary Document Source (Node.js API Only)
 * Provides lazy binary access via Node.js Buffer and stream primitives.
 */

export interface BinaryDocumentSource {
  readonly byteLength: number;
  getBuffer(): Promise<Buffer>;
  openStream?(): NodeJS.ReadableStream;
}
