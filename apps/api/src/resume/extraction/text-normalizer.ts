import * as crypto from 'node:crypto';

/**
 * Deterministic Text Normalization & Checksum Utilities
 * Implements Text Normalization Rule V1:
 * 1. Unicode NFC normalization
 * 2. Line ending canonicalization (\r\n and \r -> \n)
 * 3. Trailing horizontal whitespace elimination per line
 * 4. Horizontal whitespace collapsing (multiple spaces/tabs -> single space)
 * 5. Blank line clamping (>=3 newlines -> 2 newlines)
 * 6. Case folding (lowercase)
 * 7. Full string trimming
 */

export const TEXT_NORMALIZATION_VERSION = 'v1';

export function normalizeTextV1(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // 1. Unicode NFC normalization
      .normalize('NFC')
      // 2. Normalize CRLF and CR to LF
      .replace(/\r\n|\r/g, '\n')
      // 3. Remove trailing whitespace on each line
      .replace(/[ \t]+$/gm, '')
      // 4. Collapse multiple horizontal whitespace characters into a single space
      .replace(/[ \t]+/g, ' ')
      // 5. Collapse 3 or more consecutive newlines into 2
      .replace(/\n{3,}/g, '\n\n')
      // 6. Case folding
      .toLowerCase()
      // 7. Trim start and end
      .trim()
  );
}

/**
 * Computes deterministic textChecksum following Rule V1.
 * Format: "v1:<sha256_hex>"
 */
export function computeTextChecksumV1(rawText: string): string {
  const normalized = normalizeTextV1(rawText);
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `${TEXT_NORMALIZATION_VERSION}:${hash}`;
}

/**
 * Computes binaryChecksum (SHA-256) of raw binary buffer.
 */
export function computeBinaryChecksum(buffer: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
