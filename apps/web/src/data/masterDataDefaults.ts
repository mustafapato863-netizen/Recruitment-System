import type { InterviewType } from '@recruitflow/contracts';

/** Used only while the catalog endpoint is unavailable during local startup. */
export const CANDIDATE_SOURCE_FALLBACK = [
  'CV Intake Upload',
  'Career Site',
  'Direct Sourcing',
  'LinkedIn',
  'Other Job Board',
  'Employee Referral',
  'Recruitment Agency',
  'Walk-in',
  'Campus Recruitment',
  'Other',
] as const;

export const INTERVIEW_TYPE_FALLBACK: Array<{ code: InterviewType; name: string; defaultDuration: number }> = [
  { code: 'Screening', name: 'Screening', defaultDuration: 30 },
  { code: 'Technical', name: 'Technical', defaultDuration: 60 },
  { code: 'Behavioral', name: 'Behavioral', defaultDuration: 45 },
  { code: 'Managerial', name: 'Managerial', defaultDuration: 45 },
  { code: 'Executive', name: 'Executive', defaultDuration: 45 },
];

export const INTERVIEW_TYPE_CODES = new Set<InterviewType>(INTERVIEW_TYPE_FALLBACK.map((item) => item.code));
