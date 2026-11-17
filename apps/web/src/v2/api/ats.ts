import { getApi, patchApi, postFormDataApi } from '../../api/client';
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
  return getApi<CandidateJobRecommendation[]>(`/candidates/${encodeURIComponent(candidateId)}/job-recommendations`);
}

/**
 * Upload a PDF, Word, or text Job Description document for a vacancy.
 */
export async function uploadVacancyJd(
  vacancyId: string,
  file: File,
): Promise<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }> {
  const formData = new FormData();
  formData.append('file', file);
  return postFormDataApi<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }>(
    `/vacancies/${encodeURIComponent(vacancyId)}/jd`,
    formData,
  );
}

/**
 * Fetch the current JD document and structured criteria for a vacancy.
 */
export async function fetchVacancyJd(
  vacancyId: string,
): Promise<{ document: VacancyDocumentItem | null; criteria: JdCriteriaDefinition | null }> {
  return getApi<{ document: VacancyDocumentItem | null; criteria: JdCriteriaDefinition | null }>(
    `/vacancies/${encodeURIComponent(vacancyId)}/jd`,
  );
}

/**
 * Update and optionally lock the recruiter-reviewed JD criteria.
 */
export async function updateVacancyCriteria(
  vacancyId: string,
  criteria: Partial<JdCriteriaDefinition>,
): Promise<JdCriteriaDefinition> {
  return patchApi<JdCriteriaDefinition>(`/vacancies/${encodeURIComponent(vacancyId)}/criteria`, criteria);
}
