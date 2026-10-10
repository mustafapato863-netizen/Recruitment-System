import type { UserProfile } from '@recruitflow/contracts';

/**
 * Who sees "My interviews". Today interviewers are the INTERVIEWER role; B0b turns it
 * into the INTERVIEW_PARTICIPATE permission. Both count. The API needs VACANCY_VIEW.
 */
export function canUseMyInterviews(user: Pick<UserProfile, 'roles' | 'permissions'> | null | undefined): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  const isInterviewer = perms.includes('INTERVIEW_PARTICIPATE') || (user.roles ?? []).some((r) => r.code === 'INTERVIEWER');
  return isInterviewer && perms.includes('VACANCY_VIEW');
}
