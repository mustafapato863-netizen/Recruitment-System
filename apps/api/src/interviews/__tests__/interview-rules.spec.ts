import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_HOSTS, hostAllowed, roomHostsFromEnv, validateInterviewRoom } from '../interview-rules';

const code = (fn: () => unknown) => {
  try { fn(); return 'ok'; } catch (e) { return (e as { getResponse: () => { code: string } }).getResponse().code; }
};

describe('B5 room URL validation', () => {
  it('accepts https links on the default meeting hosts', () => {
    for (const url of ['https://teams.microsoft.com/l/meetup-join/x', 'https://us02web.zoom.us/j/123', 'https://zoom.us/j/1', 'https://meet.google.com/abc-defg-hij', 'https://acme.webex.com/meet/x']) {
      expect(validateInterviewRoom({ locationUrl: url })).toEqual({ locationUrl: url, roomName: null });
    }
  });
  it('rejects http, unknown hosts, look-alikes, credentials and garbage', () => {
    expect(code(() => validateInterviewRoom({ locationUrl: 'http://meet.google.com/abc' }))).toBe('ROOM_URL_NOT_HTTPS');
    expect(code(() => validateInterviewRoom({ locationUrl: 'https://evil.example.com/x' }))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
    expect(code(() => validateInterviewRoom({ locationUrl: 'https://zoom.us.evil.com/j/1' }))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
    expect(code(() => validateInterviewRoom({ locationUrl: 'https://notzoom.us/j/1' }))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
    expect(code(() => validateInterviewRoom({ locationUrl: 'https://user:pw@zoom.us/j/1' }))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
    expect(code(() => validateInterviewRoom({ locationUrl: 'javascript:alert(1)' }))).toBe('ROOM_URL_NOT_HTTPS');
    expect(code(() => validateInterviewRoom({ locationUrl: 'not a url' }))).toBe('ROOM_URL_INVALID');
  });
  it('a physical room is plain text; one of the two is required', () => {
    expect(validateInterviewRoom({ roomName: ' HR 2.14 ' })).toEqual({ locationUrl: null, roomName: 'HR 2.14' });
    expect(code(() => validateInterviewRoom({}))).toBe('ROOM_REQUIRED');
    expect(code(() => validateInterviewRoom({ locationUrl: '  ', roomName: '' }))).toBe('ROOM_REQUIRED');
  });
  it('allowlist comes from INTERVIEW_ROOM_HOSTS with a sensible default', () => {
    expect(roomHostsFromEnv({})).toEqual(DEFAULT_ROOM_HOSTS);
    const hosts = roomHostsFromEnv({ INTERVIEW_ROOM_HOSTS: 'meet.sgh.ae, *.corp.example' });
    expect(hosts).toEqual(['meet.sgh.ae', '*.corp.example']);
    expect(hostAllowed('a.corp.example', hosts)).toBe(true);
    expect(hostAllowed('corp.example', hosts)).toBe(false);
    expect(code(() => validateInterviewRoom({ locationUrl: 'https://zoom.us/j/1' }, hosts))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
  });
});
