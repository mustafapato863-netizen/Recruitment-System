export interface BlockingReason {
  key: string;
  label: string;
  action: 'completeSetup' | 'assignRecruiter';
  actionLabel: 'Complete setup' | 'Assign recruiter';
  isRecruiterAction: boolean;
}

export interface VacancyForActivationCheck {
  id?: string;
  title?: string | null;
  jobSummary?: string | null;
  department?: string | null;
  location?: string | null;
  branchId?: string | null;
  approvedHeadcount?: number | null;
  requiredSkills?: string[] | null;
  position?: {
    id?: string;
    title?: string;
    requiredSkills?: string[] | null;
    skills?: string[] | null;
  } | null;
  recruiter?: { name?: string | null } | null;
  assignments?: Array<{ roleCode?: string; isActive?: boolean; assignmentKind?: string }> | null;
  primaryRecruiterId?: string | null;
}

export function getBlockingReasons(vacancy: VacancyForActivationCheck): BlockingReason[] {
  const reasons: BlockingReason[] = [];

  if (!vacancy.jobSummary?.trim()) {
    reasons.push({
      key: 'jobSummary',
      label: 'Job Summary missing',
      action: 'completeSetup',
      actionLabel: 'Complete setup',
      isRecruiterAction: false,
    });
  }

  const hasPrimaryRecruiter = Boolean(
    vacancy.primaryRecruiterId ||
      (vacancy.recruiter?.name && vacancy.recruiter.name !== 'Unassigned') ||
      vacancy.assignments?.some(
        (a) => a.isActive && (a.roleCode === 'RECRUITER' || a.roleCode === 'LEAD_RECRUITER' || (a.assignmentKind ?? 'PRIMARY') === 'PRIMARY'),
      ),
  );

  if (!hasPrimaryRecruiter) {
    reasons.push({
      key: 'recruiter',
      label: 'No Primary Recruiter assigned',
      action: 'assignRecruiter',
      actionLabel: 'Assign recruiter',
      isRecruiterAction: true,
    });
  }

  if (!vacancy.department?.trim() || vacancy.department === '—') {
    reasons.push({
      key: 'department',
      label: 'Department missing',
      action: 'completeSetup',
      actionLabel: 'Complete setup',
      isRecruiterAction: false,
    });
  }

  const hasLocation = Boolean(vacancy.branchId || (vacancy.location?.trim() && vacancy.location !== '—'));
  if (!hasLocation) {
    reasons.push({
      key: 'location',
      label: 'Work location missing',
      action: 'completeSetup',
      actionLabel: 'Complete setup',
      isRecruiterAction: false,
    });
  }

  if (!vacancy.approvedHeadcount || vacancy.approvedHeadcount < 1) {
    reasons.push({
      key: 'headcount',
      label: 'Approved headcount not set',
      action: 'completeSetup',
      actionLabel: 'Complete setup',
      isRecruiterAction: false,
    });
  }

  const resolvedSkills =
    (vacancy.requiredSkills && vacancy.requiredSkills.length > 0)
      ? vacancy.requiredSkills
      : (vacancy.position?.requiredSkills && vacancy.position.requiredSkills.length > 0)
      ? vacancy.position.requiredSkills
      : vacancy.position?.skills;

  if (!resolvedSkills || resolvedSkills.length === 0) {
    reasons.push({
      key: 'skills',
      label: 'Required skills not defined',
      action: 'completeSetup',
      actionLabel: 'Complete setup',
      isRecruiterAction: false,
    });
  }

  return reasons;
}

export const getVacancyBlockingReasons = getBlockingReasons;

export function isReadyToActivate(vacancy: VacancyForActivationCheck): boolean {
  return getBlockingReasons(vacancy).length === 0;
}

