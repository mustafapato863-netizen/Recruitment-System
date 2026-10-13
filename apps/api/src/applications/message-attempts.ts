import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Controlled local sink. Never a candidate address. */
export const LOCAL_TEST_DESTINATION = 'local-test@recruitflow.local';
export const MESSAGE_ATTEMPT_ACTION = 'MESSAGE_ATTEMPT';

export type MessageState = 'Queued' | 'Sent' | 'Failed';

export function mailDeliveryEnabled(): boolean {
  return !['false', '0'].includes(process.env.MAIL_DELIVERY_ENABLED?.trim().toLowerCase() ?? 'true');
}

/**
 * A send while delivery is off fails and does not leave the server.
 * A retry is a new attempt: the local test sink accepts it, and the failed row stays.
 * When delivery is on, both attempts are queued to the local test destination only.
 */
export function attemptOutcome(kind: 'send' | 'retry', deliveryEnabled: boolean): { state: MessageState; reason: string } {
  if (!deliveryEnabled && kind === 'send') {
    return {
      state: 'Failed',
      reason: 'Mail delivery is disabled. Nothing was sent. A saved mail setting is not a connection.',
    };
  }
  if (!deliveryEnabled && kind === 'retry') {
    return {
      state: 'Sent',
      reason: 'Delivered to the local test destination. The earlier failed attempt stays in history.',
    };
  }
  return {
    state: 'Queued',
    reason: 'Queued for the local test destination. The candidate was not the recipient.',
  };
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

export async function writeLocalTestMessage(id: string, contents: string): Promise<void> {
  const dir = resolve(process.cwd(), 'storage', 'local-messages');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.txt`), contents, { encoding: 'utf8', flag: 'wx' });
}
