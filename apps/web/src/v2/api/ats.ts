import { getApi, patchApi, postApi, postFormDataApi } from '../../api/client';
import type {
  AtsEvaluationResult,
  CandidateJobRecommendation,
  JdCriteriaDefinition,
  VacancyDocumentItem,
} from '@recruitflow/contracts';

/**
 * Fetch explainable ATS score and criteria breakdown for an application.
 * Note: Never piped through stripScores to maintain ATS diagnostic visibility.
 */
export async function fetchApplicationAts(applicationId: string): Promise<AtsEvaluationResult> {
  return getApi<AtsEvaluationResult>(`/applications/${encodeURIComponent(applicationId)}/ats-match`);
}

/**
 * Recommend active open jobs for a candidate based on ATS matching.
 */
export async function fetchCandidateJobRecommendations(candidateId: string): Promise<CandidateJobRecommendation[]> {
  const res = await getApi<CandidateJobRecommendation[] | { data?: CandidateJobRecommendation[] }>(
    `/candidates/${encodeURIComponent(candidateId)}/job-recommendations`,
  );
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object' && Array.isArray(res.data)) return res.data;
  return [];
}

/**
 * Upload a PDF, Word, or text Job Description document for a vacancy or requisition.
 */
export async function uploadVacancyJd(
  vacancyId: string,
  file: File,
): Promise<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    return await postFormDataApi<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }>(
      `/vacancies/${encodeURIComponent(vacancyId)}/jd`,
      formData,
    );
  } catch {
    return postFormDataApi<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }>(
      `/vacancy-requests/${encodeURIComponent(vacancyId)}/jd`,
      formData,
    );
  }
}

/**
 * Save written or edited JD text directly, parsing requirements and extracting criteria.
 */
export async function saveVacancyJdText(
  targetId: string,
  text: string,
  fileName?: string,
): Promise<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }> {
  try {
    return await postApi<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }>(
      `/vacancies/${encodeURIComponent(targetId)}/jd-text`,
      { text, fileName },
    );
  } catch {
    return postApi<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }>(
      `/vacancy-requests/${encodeURIComponent(targetId)}/jd-text`,
      { text, fileName },
    );
  }
}

/**
 * Fetch the current JD document and structured criteria for a vacancy or requisition.
 */
export async function fetchVacancyJd(
  vacancyId: string,
): Promise<{ document: VacancyDocumentItem | null; criteria: JdCriteriaDefinition | null }> {
  try {
    return await getApi<{ document: VacancyDocumentItem | null; criteria: JdCriteriaDefinition | null }>(
      `/vacancies/${encodeURIComponent(vacancyId)}/jd`,
    );
  } catch {
    return getApi<{ document: VacancyDocumentItem | null; criteria: JdCriteriaDefinition | null }>(
      `/vacancy-requests/${encodeURIComponent(vacancyId)}/jd`,
    );
  }
}

/**
 * Update and optionally lock the recruiter-reviewed JD criteria.
 */
export async function updateVacancyCriteria(
  vacancyId: string,
  criteria: Partial<JdCriteriaDefinition>,
): Promise<JdCriteriaDefinition> {
  try {
    return await patchApi<JdCriteriaDefinition>(`/vacancies/${encodeURIComponent(vacancyId)}/criteria`, criteria);
  } catch {
    return patchApi<JdCriteriaDefinition>(`/vacancy-requests/${encodeURIComponent(vacancyId)}/criteria`, criteria);
  }
}
