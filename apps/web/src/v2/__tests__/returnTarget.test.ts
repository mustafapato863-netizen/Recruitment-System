import { describe, expect, it } from 'vitest';
import { routeActor } from '../destinations';
import { allowedReturn, returnFromLocation, withReturnTo } from '../returnTarget';

const recruiter = routeActor('employee', {
  roles: [{ code: 'RECRUITER' }],
  permissions: ['CANDIDATE_VIEW', 'VACANCY_VIEW', 'APPLICATION_VIEW'],
});
const noCandidates = routeActor('employee', {
  roles: [{ code: 'RECRUITER' }],
  permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW'],
});
const noVacancy = routeActor('employee', {
  roles: [{ code: 'RECRUITER' }],
  permissions: ['CANDIDATE_VIEW', 'APPLICATION_VIEW'],
});
const interviewer = routeActor('employee', {
  roles: [{ code: 'INTERVIEWER' }],
  permissions: ['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE'],
});

describe('returnFromLocation', () => {
  it('keeps My Work, Candidates, Compare, Search, Notifications, and a job pipeline, including sanitized queries', () => {
    expect(returnFromLocation('/my-work', '')).toBe('/my-work');
    expect(returnFromLocation('/my-work', '?day=tomorrow&tab=joining&filter=waiting')).toBe('/my-work?day=tomorrow&tab=joining&filter=waiting');
    expect(returnFromLocation('/candidates', '?stage=Interview&search=laravel')).toBe('/candidates?stage=Interview&search=laravel');
    expect(returnFromLocation('/candidates', '?search=HRIS&job=v1&source=LinkedIn&stage=Interview&ids=c-a7,c-a4')).toBe(
      '/candidates?search=HRIS&job=v1&source=LinkedIn&stage=Interview&ids=c-a7,c-a4',
    );
    expect(returnFromLocation('/candidates/compare', '?job=v1&ids=c1,c2&search=HRIS&source=LinkedIn&stage=Interview')).toBe(
      '/candidates/compare?job=v1&ids=c1,c2&search=HRIS&source=LinkedIn&stage=Interview',
    );
    expect(returnFromLocation('/search', '?q=Ahmed')).toBe('/search?q=Ahmed');
    expect(returnFromLocation('/notifications', '?page=2')).toBe('/notifications?page=2');
    expect(returnFromLocation('/vacancies/j1', '?stage=Offer')).toBe('/vacancies/j1?stage=Offer');
  });

  it('drops a nested returnTo, sanitizes unknown keys, and rejects pages the file will not navigate back to', () => {
    expect(returnFromLocation('/my-work', '?day=tomorrow&returnTo=%2Fsettings')).toBe('/my-work?day=tomorrow');
    expect(returnFromLocation('/search', '?q=Ahmed&returnTo=%2Fmy-work&junk=1')).toBe('/search?q=Ahmed');
    expect(returnFromLocation('/candidates', '?stage=Interview&junk=1')).toBe('/candidates?stage=Interview');
    expect(returnFromLocation('/search', '')).toBeNull();
    expect(returnFromLocation('/candidates/compare', '?job=v1&ids=c1')).toBeNull();
    expect(returnFromLocation('/vacancies/j1/edit', '')).toBeNull();
  });
});

describe('allowedReturn', () => {
  it('accepts the file contract for an actor who can open that page', () => {
    expect(allowedReturn('/candidates?stage=Interview&q=laravel', recruiter)).toBe('/candidates?stage=Interview&q=laravel');
    expect(allowedReturn('/candidates/compare?job=v1&ids=c1,c2', recruiter)).toBe('/candidates/compare?job=v1&ids=c1,c2');
    expect(allowedReturn('/my-work?day=tomorrow&tab=joining', recruiter)).toBe('/my-work?day=tomorrow&tab=joining');
    expect(allowedReturn('/vacancies/j1?stage=Offer', recruiter)).toBe('/vacancies/j1?stage=Offer');
    expect(allowedReturn('/search?q=Ahmed', recruiter)).toBe('/search?q=Ahmed');
    expect(allowedReturn('/search?q=Ahmed', routeActor('manager', { roles: [{ code: 'HIRING_MANAGER' }], permissions: ['APPLICATION_VIEW'] }))).toBe('/search?q=Ahmed');
    expect(
      allowedReturn(
        '/notifications?page=2',
        routeActor('employee', {
          roles: [{ code: 'RECRUITER' }],
          permissions: ['NOTIFICATION_VIEW', 'APPLICATION_VIEW'],
        }),
      ),
    ).toBe('/notifications?page=2');
  });

  it('rejects external, malformed, nested, and unauthorized targets', () => {
    const rejected = [
      'https://evil.example/candidates',
      '//evil.example/candidates',
      '/settings',
      '/candidates/extra',
      '/applications/a1',
      '/vacancies',
      '/vacancies/j1/edit',
      '/my-work/../settings',
      '/search',
      '/search?q=',
      '/search?q=https://evil.example',
      '/search?q=Ahmed&returnTo=/my-work',
      '/candidates/compare?job=v1',
      '/candidates/compare?job=v1&ids=c1',
      '/candidates/compare?job=v1&ids=c1,c2,c3,c4,c5',
      `/${'a'.repeat(2001)}`,
      '/candidates?\nstage=Interview',
      '/candidates?a=1?b=2',
      '/candidates?returnTo=/my-work',
    ];
    for (const raw of rejected) expect(allowedReturn(raw, recruiter)).toBeNull();
    expect(allowedReturn('/candidates', interviewer)).toBeNull();
    expect(allowedReturn('/candidates/compare?job=v1&ids=c1,c2', interviewer)).toBeNull();
    expect(allowedReturn('/candidates', noCandidates)).toBeNull();
    expect(allowedReturn('/candidates/compare?job=v1&ids=c1,c2', noCandidates)).toBeNull();
    expect(allowedReturn('/notifications', noCandidates)).toBeNull();
    expect(allowedReturn('/vacancies/j1', noVacancy)).toBeNull();
    expect(allowedReturn('/candidates', routeActor('manager', { roles: [{ code: 'HIRING_MANAGER' }], permissions: ['APPLICATION_VIEW', 'CANDIDATE_VIEW'] }))).toBeNull();
    expect(allowedReturn('/candidates/compare?job=v1&ids=c1,c2', routeActor('manager', { roles: [{ code: 'HIRING_MANAGER' }], permissions: ['APPLICATION_VIEW', 'CANDIDATE_VIEW'] }))).toBeNull();
  });
});

describe('withReturnTo', () => {
  it('appends a shaped return only on application, offer, hire, and candidate detail links', () => {
    const back = '/my-work?filter=waiting';
    const encoded = encodeURIComponent(back);
    expect(withReturnTo('/applications/a1?drawer=scorecard&interview=i1', back)).toBe(`/applications/a1?drawer=scorecard&interview=i1&returnTo=${encoded}`);
    expect(withReturnTo('/offers/o1', back)).toBe(`/offers/o1?returnTo=${encoded}`);
    expect(withReturnTo('/hires/h1', back)).toBe(`/hires/h1?returnTo=${encoded}`);
    expect(withReturnTo('/candidates/c1', back)).toBe(`/candidates/c1?returnTo=${encoded}`);
    expect(withReturnTo('/applications/a1', '/search?q=Ahmed')).toBe(`/applications/a1?returnTo=${encodeURIComponent('/search?q=Ahmed')}`);
    expect(withReturnTo('/applications/a1', '/candidates/compare?job=v1&ids=c1,c2')).toBe(
      `/applications/a1?returnTo=${encodeURIComponent('/candidates/compare?job=v1&ids=c1,c2')}`,
    );
    expect(withReturnTo('/vacancies/j1', back)).toBe('/vacancies/j1');
    expect(withReturnTo('/my-interviews?interview=i1', back)).toBe('/my-interviews?interview=i1');
    expect(withReturnTo('/candidates?tab=bank', back)).toBe('/candidates?tab=bank');
    expect(withReturnTo('/candidates/compare?job=v1&ids=c1,c2', back)).toBe('/candidates/compare?job=v1&ids=c1,c2');
  });

  it('leaves an existing returnTo and rejects a return the file will not keep', () => {
    expect(withReturnTo('/applications/a1?returnTo=%2Fcandidates', '/my-work')).toBe('/applications/a1?returnTo=%2Fcandidates');
    expect(withReturnTo('/applications/a1', 'https://evil.example/my-work')).toBe('/applications/a1');
    expect(withReturnTo('/applications/a1', '/search')).toBe('/applications/a1');
    expect(withReturnTo('/applications/a1', '/candidates/compare?job=v1')).toBe('/applications/a1');
    expect(withReturnTo('/applications/a1', 0 as unknown as string)).toBe('/applications/a1');
  });
});
