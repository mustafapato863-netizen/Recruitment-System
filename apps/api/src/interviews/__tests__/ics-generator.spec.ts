import { describe, it, expect } from 'vitest';
import { generateIcsCalendar } from '../ics-generator';

describe('generateIcsCalendar', () => {
  it('generates standard RFC 5545 iCalendar format with valid VEVENT properties', () => {
    const start = new Date('2026-09-10T10:00:00.000Z');
    const end = new Date('2026-09-10T10:45:00.000Z');

    const ics = generateIcsCalendar({
      uid: 'INT-2026-001@recruitflow.sghgroup.sa',
      title: 'Clinical Peer Assessment - Dr. Tariq',
      description: 'Saudi German Health\nInterview with Clinical Panel.',
      location: 'https://teams.microsoft.com/l/meetup-join/sgh-telehealth',
      start,
      end,
      organizerName: 'Saudi German Health Recruitment',
      organizerEmail: 'careers@sghgroup.sa',
      attendees: [
        { name: 'Dr. Tariq', email: 'tariq@sghgroup.sa' },
        { name: 'Dr. Sara Al-Otaibi', email: 'sara@example.com' },
      ],
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Saudi German Health//RecruitFlow Recruitment 1.0//EN');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:INT-2026-001@recruitflow.sghgroup.sa');
    expect(ics).toContain('DTSTART:20260910T100000Z');
    expect(ics).toContain('DTEND:20260910T104500Z');
    expect(ics).toContain('SUMMARY:Clinical Peer Assessment - Dr. Tariq');
    expect(ics).toContain('LOCATION:https://teams.microsoft.com/l/meetup-join/sgh-telehealth');
    expect(ics).toContain('ORGANIZER;CN=Saudi German Health Recruitment:mailto:careers@sghgroup.sa');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=Dr. Tariq:mailto:tariq@sghgroup.sa');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=Dr. Sara Al-Otaibi:mailto:sara@example.com');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('correctly escapes special characters in titles and descriptions', () => {
    const start = new Date('2026-09-15T08:00:00.000Z');
    const end = new Date('2026-09-15T09:00:00.000Z');

    const ics = generateIcsCalendar({
      uid: 'INT-2026-002@recruitflow.sghgroup.sa',
      title: 'Interview: Surgery; Orthopedics, HOD Round',
      description: 'Line 1\nLine 2; with semicolon, and comma.',
      start,
      end,
    });

    expect(ics).toContain('SUMMARY:Interview: Surgery\\; Orthopedics\\, HOD Round');
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2\\; with semicolon\\, and comma.');
  });
});
