import { BadRequestException } from '@nestjs/common';

/**
 * B5 (v2 §7 "Link is a room URL"): an interview has an online room (https URL
 * on an allowlisted meeting host) or a physical room (text). One is required.
 *
 * INTERVIEW_ROOM_HOSTS: comma-separated hosts; "*.example.com" also matches subdomains.
 * Default: Microsoft Teams, Zoom, Google Meet, Webex.
 */
export const DEFAULT_ROOM_HOSTS = [
  'teams.microsoft.com',
  'teams.live.com',
  'zoom.us',
  '*.zoom.us',
  'meet.google.com',
  'webex.com',
  '*.webex.com',
];

export function roomHostsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.INTERVIEW_ROOM_HOSTS?.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return raw && raw.length ? raw : DEFAULT_ROOM_HOSTS;
}

export function hostAllowed(host: string, allowlist: string[]): boolean {
  const h = host.toLowerCase();
  return allowlist.some((entry) => (entry.startsWith('*.') ? h.endsWith(entry.slice(1)) && h !== entry.slice(2) : h === entry));
}

export function validateInterviewRoom(
  input: { locationUrl?: string | null | undefined; roomName?: string | null | undefined },
  allowlist: string[] = roomHostsFromEnv(),
): { locationUrl: string | null; roomName: string | null } {
  const url = input.locationUrl?.trim() || null;
  const room = input.roomName?.trim() || null;
  if (!url && !room) {
    throw new BadRequestException({ code: 'ROOM_REQUIRED', message: 'Add a meeting room URL (online) or a physical room.' });
  }
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException({ code: 'ROOM_URL_INVALID', message: 'The meeting link is not a valid URL.' });
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException({ code: 'ROOM_URL_NOT_HTTPS', message: 'The meeting link must use https.' });
    }
    if (parsed.username || parsed.password || !hostAllowed(parsed.hostname, allowlist)) {
      throw new BadRequestException({
        code: 'ROOM_URL_HOST_NOT_ALLOWED',
        message: `The meeting link must be on an approved meeting host (${allowlist.join(', ')}).`,
      });
    }
  }
  return { locationUrl: url, roomName: room };
}

/** B5: scorecard state for API responses. isLocked is derived (Submitted), not stored. */
export function scorecardState(sc: {
  status: string;
  revision: number;
  previousRevisionId: string | null;
  revisedById: string | null;
  revisionReason: string | null;
  submittedAt: Date | null;
  createdAt: Date;
}) {
  return {
    status: sc.status as 'Draft' | 'Submitted',
    revision: sc.revision,
    previousRevisionId: sc.previousRevisionId,
    revisedById: sc.revisedById,
    revisionReason: sc.revisionReason,
    isLocked: sc.status === 'Submitted',
    submittedAt: (sc.submittedAt ?? sc.createdAt).toISOString(),
  };
}
