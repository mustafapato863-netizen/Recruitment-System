/** Shared joining contract. The API enforces these codes; clients must not invent a parallel rule. */
export const JOINING_CHECK_TYPES = ['ID', 'CONTRACT', 'SCFHS_LICENCE'] as const;
export type JoiningCheckType = (typeof JOINING_CHECK_TYPES)[number];

export type RequirementProfile = 'technical' | 'clinical' | 'legacy';

export interface RequirementSnapshot {
  profile: RequirementProfile;
  checks: JoiningCheckType[];
}

/** Records actual joining. Does not grant FINAL_HIRING_APPROVAL. */
export const RECORD_ACTUAL_JOINING = 'RECORD_ACTUAL_JOINING';

export const joiningErrorCodes = [
  'JOINING_PERMISSION_REQUIRED',
  'JOINING_NOT_OWNER',
  'WRONG_ORGANIZATION',
  'FINAL_APPROVAL_REQUIRED',
  'APPROVAL_STALE',
  'LICENCE_EXPIRED',
  'LICENCE_EXPIRY_REQUIRED',
  'CAPACITY_FULL',
  'JOINING_DATE_REQUIRED',
  'JOINING_CHECK_NOT_REQUIRED',
  'HIRING_APPROVAL_INVALIDATED',
] as const;
