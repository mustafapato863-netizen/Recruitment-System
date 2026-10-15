import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Controlled local sink. Never a candidate address. */
export const LOCAL_TEST_DESTINATION = 'local-test@recruitflow.local';
export const MESSAGE_ATTEMPT_ACTION = 'MESSAGE_ATTEMPT';

export type MessageState = 'Queued' | 'Sent' | 'Failed';

const OPEN_INTERVIEW = new Set(['Scheduled', 'Rescheduled']);
const cairoDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const cairoTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface MessageInterviewSource {
  status: string;
  scheduledStart: Date;
  locationUrl: string | null;
  legacyInterviewerName: string | null;
  attendees: Array<{ role: string; displayName: string | null }>;
}

export interface MessageCompositionSource {
  stage: string | null;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  positionTitle: string | null;
  organizationName: string | null;
  recruiterName: string | null;
  interviews: MessageInterviewSource[];
}

export interface MessageTemplateData {
  candidateName: string;
  positionTitle: string;
  organizationName: string;
  stageName: string;
  recruiterName: string;
  interviewDate: string;
  interviewTime: string;
  interviewerName: string;
  roomLink: string;
}

export function mailDeliveryEnabled(): boolean {
  return !['false', '0'].includes(process.env.MAIL_DELIVERY_ENABLED?.trim().toLowerCase() ?? 'true');
}

/**
 * A send while delivery is off fails and does not leave the server.
 * A retry while delivery is off is logged locally, nothing is sent, and the earlier failed attempt stays.
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
      state: 'Failed',
      reason: 'Logged locally and nothing was sent. The earlier failed attempt stays in history.',
    };
  }
  return {
    state: 'Queued',
    reason: 'Queued for the local test destination. The candidate was not the recipient.',
  };
}

function blank(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? '';
}

/** Calendar date and clock time of an instant in Africa/Cairo. */
export function formatInterviewWhen(instant: Date): { interviewDate: string; interviewTime: string } {
  const dateParts = cairoDate.formatToParts(instant);
  const timeParts = cairoTime.formatToParts(instant);
  let hour = part(timeParts, 'hour');
  if (hour === '24') hour = '00';
  return {
    interviewDate: `${part(dateParts, 'day')} ${part(dateParts, 'month')} ${part(dateParts, 'year')}`,
    interviewTime: `${hour.padStart(2, '0')}:${part(timeParts, 'minute').padStart(2, '0')}`,
  };
}

function pickInterview(interviews: MessageInterviewSource[]): MessageInterviewSource | undefined {
  const open = interviews.filter((row) => OPEN_INTERVIEW.has(row.status) && row.scheduledStart instanceof Date && !Number.isNaN(row.scheduledStart.getTime()));
  if (open.length === 0) return undefined;
  const now = Date.now();
  const upcoming = open
    .filter((row) => row.scheduledStart.getTime() >= now)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  if (upcoming[0]) return upcoming[0];
  return [...open].sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())[0];
}

function interviewerName(interview: MessageInterviewSource): string {
  const preferred = interview.attendees.find((row) => row.role === 'Interviewer' && blank(row.displayName));
  const anyNamed = interview.attendees.find((row) => blank(row.displayName));
  return blank((preferred ?? anyNamed)?.displayName) || blank(interview.legacyInterviewerName);
}

/** Template data for one application. Missing values stay empty. No pay, documents, or secrets. */
export function messageTemplateData(source: MessageCompositionSource): MessageTemplateData {
  const interview = pickInterview(source.interviews);
  const when = interview ? formatInterviewWhen(interview.scheduledStart) : { interviewDate: '', interviewTime: '' };
  return {
    candidateName: [blank(source.candidateFirstName), blank(source.candidateLastName)].filter(Boolean).join(' '),
    positionTitle: blank(source.positionTitle),
    organizationName: blank(source.organizationName),
    stageName: blank(source.stage),
    recruiterName: blank(source.recruiterName),
    interviewDate: when.interviewDate,
    interviewTime: when.interviewTime,
    interviewerName: interview ? interviewerName(interview) : '',
    roomLink: interview ? blank(interview.locationUrl) : '',
  };
}

const TEMPLATE_KEYS = new Set<keyof MessageTemplateData>([
  'candidateName',
  'positionTitle',
  'organizationName',
  'stageName',
  'recruiterName',
  'interviewDate',
  'interviewTime',
  'interviewerName',
  'roomLink',
]);

export function renderTemplate(text: string, vars: MessageTemplateData): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => (
    TEMPLATE_KEYS.has(key as keyof MessageTemplateData) ? vars[key as keyof MessageTemplateData] : ''
  ));
}

export async function writeLocalTestMessage(id: string, contents: string): Promise<void> {
  const dir = resolve(process.cwd(), 'storage', 'local-messages');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.txt`), contents, { encoding: 'utf8', flag: 'wx' });
}
