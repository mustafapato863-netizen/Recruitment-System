import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { presentedIntegrationStatus } from '../../integrations/integrations.service';
import { MessageAttemptsService } from '../message-attempts.service';
import { LOCAL_TEST_DESTINATION, attemptOutcome, writeLocalTestMessage } from '../message-attempts';

const ORG = 'org-1';
const USER = { userId: 'user-1', organizationId: ORG, roleCodes: ['RECRUITER'], email: 'sarah@recruitflow.local' };
const APP = 'app-1';
const TEMPLATE = 'tpl-1';

describe('message attempt outcomes', () => {
  it('keeps a failed send and records retry as a new sent attempt when delivery is off', () => {
    expect(attemptOutcome('send', false).state).toBe('Failed');
    expect(attemptOutcome('retry', false).state).toBe('Sent');
    expect(attemptOutcome('send', true).state).toBe('Queued');
    expect(attemptOutcome('retry', true).state).toBe('Queued');
    expect(LOCAL_TEST_DESTINATION).not.toMatch(/candidate|@gmail|@yahoo/i);
  });

  it('writes the local test file with the path helpers the server build keeps', async () => {
    const id = `unit-${Date.now()}`;
    const file = join(process.cwd(), 'storage', 'local-messages', `${id}.txt`);
    await writeLocalTestMessage(id, `destination: ${LOCAL_TEST_DESTINATION}\n`);
    try {
      const text = await readFile(file, 'utf8');
      expect(text).toContain(`destination: ${LOCAL_TEST_DESTINATION}`);
      expect(text).not.toMatch(/@gmail|@yahoo/i);
    } finally {
      await rm(file, { force: true });
    }
  });

  it('does not present a saved mail setting as a verified connection', () => {
    expect(presentedIntegrationStatus('smtp', 'Connected')).toBe('Not verified');
    expect(presentedIntegrationStatus('smtp', 'Available')).toBe('Available');
    expect(presentedIntegrationStatus('careers_site', 'Connected')).toBe('Connected');
  });
});

describe('MessageAttemptsService', () => {
  const audits: Array<Record<string, unknown>> = [];
  const notes: Array<Record<string, unknown>> = [];
  const queued: Array<Record<string, unknown>> = [];
  const written: string[] = [];
  let delivery: string | undefined;

  const prisma = {
    application: { findFirst: vi.fn(async () => ({
      id: APP,
      followUpDate: new Date('2026-10-20T00:00:00Z'),
      candidate: { firstName: 'Phase6', lastName: 'Sample' },
      vacancy: { vacancyCode: 'VAC-2026-011', position: { title: 'Registered Nurse' } },
      organization: { name: 'RecruitFlow' },
    })) },
    emailTemplate: {
      findFirst: vi.fn(async () => ({ id: TEMPLATE, name: 'Application Received — Acknowledgement', subject: 'Hello {{candidateName}}', bodyTemplate: 'Dear {{candidateName}}', status: 'Active' })),
      findMany: vi.fn(async () => [{ id: TEMPLATE, name: 'Application Received — Acknowledgement' }]),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, createdAt: new Date('2026-10-13T12:00:00Z'), afterData: data.afterData ?? null, reason: data.reason ?? null, result: data.result };
        audits.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => audits.find((row) => row.id === where.id) ?? null),
      findMany: vi.fn(async () => [...audits]),
    },
  };
  const access = { getApplicationVisibilityWhere: vi.fn(async () => ({ organizationId: ORG })) };
  const notifications = { create: vi.fn(async (input: Record<string, unknown>) => { notes.push(input); }) };
  const outbox = { enqueue: vi.fn(async (input: Record<string, unknown>) => { queued.push(input); }) };

  beforeEach(() => {
    audits.length = 0;
    notes.length = 0;
    queued.length = 0;
    written.length = 0;
    delivery = process.env.MAIL_DELIVERY_ENABLED;
    process.env.MAIL_DELIVERY_ENABLED = 'false';
    vi.clearAllMocks();
  });

  function service() {
    const svc = new MessageAttemptsService(prisma as never, access as never, notifications as never, outbox as never);
    svc.writeLocal = async (id) => { written.push(id); };
    return svc;
  }

  it('records a failed send, then a retry, and keeps the failed attempt', async () => {
    const svc = service();
    const failed = await svc.send(USER as never, APP, TEMPLATE);
    expect(failed.state).toBe('Failed');
    expect(failed.destination).toBe(LOCAL_TEST_DESTINATION);
    expect(failed.templateName).toContain('Acknowledgement');
    expect(written).toEqual([]);
    expect(queued).toEqual([]);
    expect(JSON.stringify(notes[0])).not.toContain('@');

    const sent = await svc.retry(USER as never, APP, failed.id);
    expect(sent.state).toBe('Sent');
    expect(sent.retryOf).toBe(failed.id);
    expect(sent.id).not.toBe(failed.id);
    expect(written).toEqual([sent.id]);
    expect(audits.map((row) => row.result)).toEqual(['Failed', 'Sent']);
    expect(audits[0]?.id).toBe(failed.id);

    const history = await svc.list(USER as never, APP);
    expect(history.followUpDate).toBe('2026-10-20');
    expect(history.attempts.map((row) => row.state)).toEqual(['Failed', 'Sent']);
    expect(history.destination).toBe(LOCAL_TEST_DESTINATION);
    expect(process.env.MAIL_DELIVERY_ENABLED).toBe('false');
    process.env.MAIL_DELIVERY_ENABLED = delivery;
  });

  it('refuses to retry an attempt that is not failed', async () => {
    const svc = service();
    const failed = await svc.send(USER as never, APP, TEMPLATE);
    await svc.retry(USER as never, APP, failed.id);
    await expect(svc.retry(USER as never, APP, failed.id)).resolves.toMatchObject({ state: 'Sent' });
    const sentId = audits[1]?.id as string;
    await expect(svc.retry(USER as never, APP, sentId)).rejects.toBeInstanceOf(ConflictException);
    expect(audits.filter((row) => row.result === 'Failed')).toHaveLength(1);
    process.env.MAIL_DELIVERY_ENABLED = delivery;
  });

  it('queues a retry to the local test destination when delivery is on', async () => {
    process.env.MAIL_DELIVERY_ENABLED = 'true';
    const svc = service();
    const queuedSend = await svc.send(USER as never, APP, TEMPLATE);
    expect(queuedSend.state).toBe('Queued');
    expect(queued[0]?.toEmail).toBe(LOCAL_TEST_DESTINATION);
    expect(String(queued[0]?.toEmail)).not.toContain('sample');
    process.env.MAIL_DELIVERY_ENABLED = delivery;
  });
});
