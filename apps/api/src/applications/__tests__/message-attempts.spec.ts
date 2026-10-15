import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ConflictException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presentedIntegrationStatus } from '../../integrations/integrations.service';
import { MessageAttemptsService } from '../message-attempts.service';
import { LOCAL_TEST_DESTINATION, attemptOutcome, messageTemplateData, writeLocalTestMessage } from '../message-attempts';

const ORG = 'org-1';
const USER = { userId: 'user-1', organizationId: ORG, roleCodes: ['RECRUITER'], email: 'sarah@recruitflow.local' };
const APP = 'app-1';
const TEMPLATE = 'tpl-1';
const INTERVIEW_AT = new Date('2026-10-19T22:30:00.000Z');
const HELLO = 'Hello {{candidateName}} for {{positionTitle}} on {{interviewDate}}';
const FILLED_HELLO = 'Hello Phase6 Sample for Registered Nurse on 20 Oct 2026';
const DETAIL = '{{interviewTime}}|{{interviewerName}}|{{roomLink}}|{{recruiterName}}|{{stageName}}|{{organizationName}}|{{salary}}|{{candidateEmail}}';
const FILLED_DETAIL = '01:30|Dr Lina|https://rooms.recruitflow.local/board|Sara Recruiter|Interview|RecruitFlow||';
const MAIL_HOST = /sendgrid|mailgun|smtp\.|gmail\.com|yahoo\.com|outlook\.com|amazonses|postmark|resend\.com|graph\.microsoft/i;

describe('message attempt outcomes', () => {
  it('keeps send and retry failed while delivery is off, and queued when delivery is on', () => {
    expect(attemptOutcome('send', false)).toEqual({
      state: 'Failed',
      reason: 'Mail delivery is disabled. Nothing was sent. A saved mail setting is not a connection.',
    });
    expect(attemptOutcome('retry', false)).toEqual({
      state: 'Failed',
      reason: 'Logged locally and nothing was sent. The earlier failed attempt stays in history.',
    });
    expect(attemptOutcome('send', true).state).toBe('Queued');
    expect(attemptOutcome('retry', true).state).toBe('Queued');
    expect(JSON.stringify(attemptOutcome('retry', false))).not.toMatch(/\bSent\b/);
    expect(LOCAL_TEST_DESTINATION).toBe('local-test@recruitflow.local');
    expect(LOCAL_TEST_DESTINATION).not.toMatch(/candidate|@gmail|@yahoo/i);
  });

  it('writes the local test file with the path helpers the server build keeps', async () => {
    const id = `unit-${Date.now()}`;
    const file = join(process.cwd(), 'storage', 'local-messages', `${id}.txt`);
    await writeLocalTestMessage(id, `destination: ${LOCAL_TEST_DESTINATION}\nstate: Failed\n`);
    try {
      const text = await readFile(file, 'utf8');
      expect(text).toContain(`destination: ${LOCAL_TEST_DESTINATION}`);
      expect(text).not.toMatch(/^state: Sent$/m);
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

  it('fills only the application fields, with the interview clock in Africa/Cairo', () => {
    const vars = messageTemplateData({
      stage: 'Interview',
      candidateFirstName: 'Phase6',
      candidateLastName: 'Sample',
      positionTitle: 'Registered Nurse',
      organizationName: 'RecruitFlow',
      recruiterName: 'Sara Recruiter',
      interviews: [
        {
          status: 'Completed',
          scheduledStart: new Date('2026-01-01T00:00:00.000Z'),
          locationUrl: 'https://rooms.recruitflow.local/old',
          legacyInterviewerName: 'Not This Person',
          attendees: [{ role: 'Interviewer', displayName: 'Not This Person' }],
        },
        {
          status: 'Scheduled',
          scheduledStart: INTERVIEW_AT,
          locationUrl: 'https://rooms.recruitflow.local/board',
          legacyInterviewerName: null,
          attendees: [{ role: 'Interviewer', displayName: 'Dr Lina' }],
        },
      ],
    });
    expect(Object.keys(vars).sort()).toEqual([
      'candidateName',
      'interviewDate',
      'interviewTime',
      'interviewerName',
      'organizationName',
      'positionTitle',
      'recruiterName',
      'roomLink',
      'stageName',
    ]);
    expect(vars).toEqual({
      candidateName: 'Phase6 Sample',
      positionTitle: 'Registered Nurse',
      organizationName: 'RecruitFlow',
      stageName: 'Interview',
      recruiterName: 'Sara Recruiter',
      interviewDate: '20 Oct 2026',
      interviewTime: '01:30',
      interviewerName: 'Dr Lina',
      roomLink: 'https://rooms.recruitflow.local/board',
    });
    expect(vars.interviewDate).not.toBe('19 Oct 2026');
  });
});

describe('MessageAttemptsService', () => {
  const audits: Array<Record<string, unknown>> = [];
  const notes: Array<Record<string, unknown>> = [];
  const queued: Array<Record<string, unknown>> = [];
  const files = new Map<string, string>();
  let delivery: string | undefined;
  let requested: string[] = [];
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

  function applicationRow() {
    return {
      id: APP,
      followUpDate: new Date('2026-10-20T00:00:00Z'),
      stage: 'Interview',
      candidate: { firstName: 'Phase6', lastName: 'Sample', email: 'phase6.sample@gmail.com' },
      vacancy: { vacancyCode: 'VAC-2026-011', position: { title: 'Registered Nurse' } },
      organization: { name: 'RecruitFlow' },
      primaryRecruiter: { displayName: 'Sara Recruiter' },
      interviews: [
        {
          status: 'Completed',
          scheduledStart: new Date('2026-01-01T00:00:00.000Z'),
          locationUrl: 'https://rooms.recruitflow.local/old',
          legacyInterviewerName: 'Not This Person',
          attendees: [{ role: 'Interviewer', user: { displayName: 'Not This Person' } }],
        },
        {
          status: 'Scheduled',
          scheduledStart: INTERVIEW_AT,
          locationUrl: 'https://rooms.recruitflow.local/board',
          legacyInterviewerName: null,
          attendees: [{ role: 'Interviewer', user: { displayName: 'Dr Lina' } }],
        },
      ],
    };
  }

  let application = applicationRow();
  let template = {
    id: TEMPLATE,
    name: 'Application Received — Acknowledgement',
    subject: HELLO,
    bodyTemplate: `${HELLO}\n${DETAIL}`,
    status: 'Active',
  };
  let templateList = [template];

  const prisma = {
    application: { findFirst: vi.fn(async () => application) },
    emailTemplate: {
      findFirst: vi.fn(async () => template),
      findMany: vi.fn(async () => templateList),
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
    files.clear();
    requested = [];
    application = applicationRow();
    template = {
      id: TEMPLATE,
      name: 'Application Received — Acknowledgement',
      subject: HELLO,
      bodyTemplate: `${HELLO}\n${DETAIL}`,
      status: 'Active',
    };
    templateList = [template];
    delivery = process.env.MAIL_DELIVERY_ENABLED;
    process.env.MAIL_DELIVERY_ENABLED = 'false';
    vi.clearAllMocks();
    prisma.application.findFirst.mockImplementation(async () => application);
    prisma.emailTemplate.findFirst.mockImplementation(async () => template);
    prisma.emailTemplate.findMany.mockImplementation(async () => templateList);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      requested.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      throw new Error('no network');
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    if (delivery === undefined) delete process.env.MAIL_DELIVERY_ENABLED;
    else process.env.MAIL_DELIVERY_ENABLED = delivery;
  });

  function service(captureLocal = true) {
    const svc = new MessageAttemptsService(prisma as never, access as never, notifications as never, outbox as never);
    if (captureLocal) {
      svc.writeLocal = async (id, contents) => { files.set(id, contents); };
    }
    return svc;
  }

  it('renders the candidate, the job, and the Cairo interview date', async () => {
    const history = await service().list(USER as never, APP);
    expect(history.templates[0]?.subject).toBe(FILLED_HELLO);
    expect(history.templates[0]?.subject).not.toContain('19 Oct');
    expect(history.templates[0]?.body).toBe(`${FILLED_HELLO}\n${FILLED_DETAIL}`);
    expect(history.destination).toBe(LOCAL_TEST_DESTINATION);
    expect(JSON.stringify(history)).not.toContain('phase6.sample@gmail.com');
  });

  it('leaves interview fields empty when the file has no interview', async () => {
    application = { ...applicationRow(), interviews: [] };
    template = {
      ...template,
      subject: HELLO,
      bodyTemplate: '{{interviewDate}}|{{interviewTime}}|{{interviewerName}}|{{roomLink}}',
    };
    templateList = [template];
    const history = await service().list(USER as never, APP);
    expect(history.templates[0]?.subject).toBe('Hello Phase6 Sample for Registered Nurse on ');
    expect(history.templates[0]?.body).toBe('|||');
    expect(history.templates[0]?.subject).not.toMatch(/Oct|20\d{2}/);
  });

  it('records a failed send and a failed retry while delivery is off', async () => {
    const svc = service(false);
    const failed = await svc.send(USER as never, APP, TEMPLATE);
    const failedFile = join(process.cwd(), 'storage', 'local-messages', `${failed.id}.txt`);
    expect(failed.state).toBe('Failed');
    expect(failed.destination).toBe(LOCAL_TEST_DESTINATION);
    expect(failed.templateName).toContain('Acknowledgement');
    expect(String(failed.reason)).not.toMatch(/\bSent\b/);
    await expect(readFile(failedFile, 'utf8')).rejects.toThrow();
    expect(queued).toEqual([]);
    expect(JSON.stringify(notes[0])).not.toContain('@');

    const retried = await svc.retry(USER as never, APP, failed.id);
    const retryFile = join(process.cwd(), 'storage', 'local-messages', `${retried.id}.txt`);
    try {
      expect(retried.state).toBe('Failed');
      expect(retried.retryOf).toBe(failed.id);
      expect(retried.id).not.toBe(failed.id);
      expect(String(retried.reason)).toMatch(/logged locally/i);
      expect(String(retried.reason)).toMatch(/nothing was sent/i);
      expect(String(retried.reason)).not.toMatch(/\bSent\b/);
      const text = await readFile(retryFile, 'utf8');
      expect(text).toContain(`destination: ${LOCAL_TEST_DESTINATION}`);
      expect(text).toContain('state: Failed');
      expect(text).not.toMatch(/^state: Sent$/m);
      expect(text).toContain(FILLED_HELLO);
      expect(text).not.toContain('phase6.sample@gmail.com');
      expect(audits.map((row) => row.result)).toEqual(['Failed', 'Failed']);
      expect(audits[0]?.id).toBe(failed.id);

      const history = await svc.list(USER as never, APP);
      expect(history.followUpDate).toBe('2026-10-20');
      expect(history.attempts.map((row) => row.state)).toEqual(['Failed', 'Failed']);
      expect(history.attempts[0]?.id).toBe(failed.id);
      expect(history.destination).toBe(LOCAL_TEST_DESTINATION);
      expect(JSON.stringify(history.attempts)).not.toMatch(/\bSent\b/);
      expect(queued).toEqual([]);
      expect(requested.join('\n')).not.toMatch(MAIL_HOST);
      expect(JSON.stringify({ queued, notes, requested })).not.toMatch(MAIL_HOST);
      expect(process.env.MAIL_DELIVERY_ENABLED).toBe('false');
    } finally {
      await rm(retryFile, { force: true });
    }
  });

  it('refuses to retry an attempt that is not failed', async () => {
    const svc = service();
    const failed = await svc.send(USER as never, APP, TEMPLATE);
    const retried = await svc.retry(USER as never, APP, failed.id);
    expect(retried.state).toBe('Failed');
    expect(files.get(retried.id)).not.toMatch(/^state: Sent$/m);
    const again = await svc.retry(USER as never, APP, failed.id);
    expect(again.state).toBe('Failed');
    expect(audits.filter((row) => row.id === failed.id && row.result === 'Failed')).toHaveLength(1);

    process.env.MAIL_DELIVERY_ENABLED = 'true';
    const queuedSend = await svc.send(USER as never, APP, TEMPLATE);
    expect(queuedSend.state).toBe('Queued');
    await expect(svc.retry(USER as never, APP, queuedSend.id)).rejects.toBeInstanceOf(ConflictException);
    expect(audits.filter((row) => row.result === 'Queued')).toHaveLength(1);
    expect(queued[0]?.toEmail).toBe(LOCAL_TEST_DESTINATION);
    expect(String(queued[0]?.toEmail)).not.toContain('gmail');
    expect(JSON.stringify(queued)).not.toMatch(MAIL_HOST);
  });

  it('queues a retry to the local test destination when delivery is on', async () => {
    process.env.MAIL_DELIVERY_ENABLED = 'true';
    const svc = service();
    const queuedSend = await svc.send(USER as never, APP, TEMPLATE);
    expect(queuedSend.state).toBe('Queued');
    expect(queued[0]?.toEmail).toBe(LOCAL_TEST_DESTINATION);
    expect(queued[0]?.subject).toBe(FILLED_HELLO);
    expect(String(queued[0]?.toEmail)).not.toContain('sample');
    expect(JSON.stringify(queued)).not.toContain('phase6.sample@gmail.com');
    expect(requested.join('\n')).not.toMatch(MAIL_HOST);
  });
});
