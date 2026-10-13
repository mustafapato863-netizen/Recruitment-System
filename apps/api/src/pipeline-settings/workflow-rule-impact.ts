/** Jobs whose stage, seat count, or accepted-case checklist must not move when a rule is previewed. */
export const PROTECTED_VACANCY_CODES = ['VAC-2026-009', 'VAC-2026-010', 'VAC-2026-011'] as const;

export type WorkflowProfile = 'technical' | 'clinical';

export interface WorkflowVacancyFact {
  id: string;
  code: string;
  status: string;
  approvedHeadcount: number;
  joinedHeadcount: number;
}

export interface WorkflowApplicationFact {
  id: string;
  code: string;
  stage: string;
  vacancyCode: string;
  hasSnapshot: boolean;
}

export interface WorkflowImpactInput {
  positionId: string;
  positionTitle: string;
  currentProfile: string | null;
  proposedProfile: WorkflowProfile;
  vacancies: WorkflowVacancyFact[];
  applications: WorkflowApplicationFact[];
}

export interface WorkflowImpact {
  positionId: string;
  positionTitle: string;
  currentProfile: string | null;
  proposedProfile: WorkflowProfile;
  applyAllowed: boolean;
  protectedVacancyCodes: string[];
  preservedSnapshots: number;
  openCasesAdoptingProfile: Array<{ code: string; vacancyCode: string; stage: string }>;
  vacancies: Array<{ code: string; status: string; approvedHeadcount: number; joinedHeadcount: number; protected: boolean }>;
  message: string;
}

export function buildWorkflowImpact(input: WorkflowImpactInput): WorkflowImpact {
  const protectedVacancyCodes = input.vacancies
    .map((vacancy) => vacancy.code)
    .filter((code) => (PROTECTED_VACANCY_CODES as readonly string[]).includes(code));
  const preservedSnapshots = input.applications.filter((application) => application.hasSnapshot).length;
  const openCasesAdoptingProfile = input.applications
    .filter((application) => !application.hasSnapshot)
    .map((application) => ({ code: application.code, vacancyCode: application.vacancyCode, stage: application.stage }));
  const applyAllowed = protectedVacancyCodes.length === 0;
  const same = input.currentProfile === input.proposedProfile;
  const message = applyAllowed
    ? (same
      ? `${input.positionTitle} already uses the ${input.proposedProfile} profile. No job would move.`
      : `${input.positionTitle} can take the ${input.proposedProfile} profile. Accepted-case checklists stay as stored. Job status and seat counts stay as they are.`)
    : `${input.positionTitle} includes ${protectedVacancyCodes.join(', ')}. Applying the ${input.proposedProfile} profile would change how those jobs read their rules, so this stays a preview. Job status and seat counts are unchanged.`;
  return {
    positionId: input.positionId,
    positionTitle: input.positionTitle,
    currentProfile: input.currentProfile,
    proposedProfile: input.proposedProfile,
    applyAllowed,
    protectedVacancyCodes,
    preservedSnapshots,
    openCasesAdoptingProfile,
    vacancies: input.vacancies.map((vacancy) => ({
      code: vacancy.code,
      status: vacancy.status,
      approvedHeadcount: vacancy.approvedHeadcount,
      joinedHeadcount: vacancy.joinedHeadcount,
      protected: protectedVacancyCodes.includes(vacancy.code),
    })),
    message,
  };
}
