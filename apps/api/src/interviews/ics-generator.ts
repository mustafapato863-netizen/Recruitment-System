/**
 * RFC 5545 iCalendar (.ics) Generator for RecruitFlow Interviews
 * Generates standards-compliant VCALENDAR / VEVENT payloads compatible with
 * Google Calendar, Microsoft Outlook, Apple Calendar, and mobile devices.
 */

export interface IcsEventOptions {
  uid: string;
  title: string;
  description: string;
  location?: string | null;
  start: Date;
  end: Date;
  organizerName?: string;
  organizerEmail?: string;
  attendees?: Array<{ name?: string; email?: string }>;
  url?: string | null;
}

function formatIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n');
}

export function generateIcsCalendar(event: IcsEventOptions): string {
  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(event.start);
  const dtEnd = formatIcsDate(event.end);
  const orgName = event.organizerName || 'Saudi German Health Recruitment';
  const orgEmail = event.organizerEmail || 'careers@sghgroup.sa';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Saudi German Health//RecruitFlow Recruitment 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  } else {
    lines.push('LOCATION:Saudi German Health • Interview Room / Video Link');
  }

  lines.push(`ORGANIZER;CN=${escapeIcsText(orgName)}:mailto:${orgEmail}`);

  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      if (attendee.email) {
        const cn = attendee.name ? `;CN=${escapeIcsText(attendee.name)}` : '';
        lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${attendee.email}`);
      }
    }
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('TRANSP:OPAQUE');
  lines.push('SEQUENCE:0');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}
