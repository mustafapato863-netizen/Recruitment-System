/** Fixtures matching PR #4 (feat/b1-ownership-scope) response shapes. */
import type { RedactedVacancy } from '../../types/redactedVacancy';

export const redactedJob: RedactedVacancy = {
  id: 'vac-other-1',
  redacted: true,
  title: 'Staff Nurse – ER',
  site: { id: 'br-jed', name: 'SGH Jeddah' },
  seats: { filled: 2, target: 5 },
};

/** #4 allows null title/site; the UI must not crash. */
export const redactedJobSparse = {
  id: 'vac-other-2',
  redacted: true,
  title: null,
  site: null,
  seats: { filled: 0, target: 1 },
} as RedactedVacancy;

export const jobNotOwnedBody = { code: 'JOB_NOT_OWNED', message: 'Access denied: this job belongs to another owner.' };
export const fileNotOwnedBody = { code: 'FILE_NOT_OWNED', message: 'Access denied: this file belongs to another owner.' };

export function forbidden(body: { code: string; message: string } = fileNotOwnedBody) {
  return Object.assign(new Error(body.message), { statusCode: 403, code: body.code, details: body });
}
