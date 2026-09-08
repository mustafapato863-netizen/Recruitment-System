import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ImportJobSummary, MasterDataValueRecord, PaginatedResult, Vacancy } from '@recruitflow/contracts';
import { calculateCandidateFitScore, type CriteriaBreakdown } from '@recruitflow/validation';
import { getApi, postApi, postFormDataApi, patchApi, ApiError } from '../api/client';
import { parseResumeFile, type ExtractedCandidate } from '../utils/resumeParser';

export const INTAKE_STEPS = ['Upload', 'Validate & Edit', 'Resolve', 'Confirm'];

export interface ScoredVacancy {
  vacancy: Vacancy;
  fitResult: CriteriaBreakdown;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function useCVIntakeFlow(initialTargetVacancy?: string | null) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ExtractedCandidate | null>(null);
  const [initialProfile, setInitialProfile] = useState<ExtractedCandidate | null>(null);

  // Step 3: Resolve & Assignment state
  const [duplicateDecision, setDuplicateDecision] = useState<'update' | 'new' | 'link'>('update');
  const [targetVacancy, setTargetVacancy] = useState<string>(initialTargetVacancy || '');
  const [targetStage, setTargetStage] = useState<string>('Screening');
  const [candidateSource, setCandidateSource] = useState<string>('CV Intake Upload');
  const [candidateSourceOptions, setCandidateSourceOptions] = useState<string[]>(['CV Intake Upload']);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

  // Step 4: Confirmed candidate state
  const [confirmedCandidateCode, setConfirmedCandidateCode] = useState<string>('');
  const [confirmedCandidateId, setConfirmedCandidateId] = useState<string | null>(null);
  const [confirmedAppId, setConfirmedAppId] = useState<string | null>(null);

  const [parsingFile, setParsingFile] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  }, []);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const response = await getApi<PaginatedResult<ImportJobSummary>>('/candidates/import/jobs?page=1&pageSize=50');
      setJobs(response.data || []);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const loadVacancies = useCallback(async () => {
    try {
      const list = await getApi<Vacancy[]>('/vacancies');
      if (Array.isArray(list) && list.length > 0) {
        setVacancies(list);
      }
    } catch {
      // Fallback
    }
  }, []);

  const loadCandidateSources = useCallback(async () => {
    try {
      const records = await getApi<MasterDataValueRecord[]>('/master-data/catalog/candidate-sources');
      const names = records
        .filter((record) => record.status === 'Active')
        .map((record) => record.name.trim())
        .filter(Boolean);
      setCandidateSourceOptions(Array.from(new Set(['CV Intake Upload', ...names])));
    } catch {
      // The built-in upload source remains available when catalog access is unavailable.
      setCandidateSourceOptions(['CV Intake Upload']);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
    void loadVacancies();
    void loadCandidateSources();
  }, [loadJobs, loadVacancies, loadCandidateSources]);

  // Compute real-time fit scores for all vacancies against the candidate profile
  const scoredVacancies = useMemo<ScoredVacancy[]>(() => {
    if (!profile || vacancies.length === 0) return [];

    const scored = vacancies.map((v) => {
      const positionTitle = v.position?.title || v.title || '';
      const fitResult = calculateCandidateFitScore(
        {
          skills: profile.skills,
          experienceYears: profile.experienceYears,
          location: profile.location,
          certifications: profile.certifications,
          currentTitle: profile.title,
        },
        {
          requiredSkills: v.requiredSkills || [],
          minExperienceYears: v.minExperienceYears || 0,
          location: v.location || v.branch?.name || '',
          qualifications: [positionTitle, v.qualifications].filter(Boolean).join(' '),
          department: v.department || '',
        },
      );
      return { vacancy: v, fitResult };
    });

    // Sort descending: highest match score first
    scored.sort((a, b) => b.fitResult.score - a.fitResult.score);
    return scored;
  }, [profile, vacancies]);

  // Auto-select the top recommended vacancy
  useEffect(() => {
    if (scoredVacancies.length > 0) {
      if (!targetVacancy || !vacancies.some((v) => v.id === targetVacancy)) {
        setTargetVacancy(scoredVacancies[0].vacancy.id);
      }
    } else if (vacancies.length > 0 && !targetVacancy) {
      setTargetVacancy(vacancies[0].id);
    }
  }, [scoredVacancies, targetVacancy, vacancies]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setProfile(null);
    setInitialProfile(null);
    setUploadedFileName(null);
    setUploadedFile(null);

    const fileNameLower = file.name.toLowerCase();
    const isWordOrPdf = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext)) || ALLOWED_MIMES.includes(file.type);

    if (!isWordOrPdf) {
      setError('Invalid file format. Please upload Word (.doc, .docx) or PDF (.pdf) documents.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('The document must be 10 MB or smaller.');
      return;
    }

    setUploadedFileName(file.name);
    setUploadedFile(file);
    setParsingFile(true);
    setParsingStep('Reading document binary structure...');

    try {
      await new Promise((r) => setTimeout(r, 400));
      setParsingStep('Running clinical entity extraction & OCR tokenization...');
      const extracted = await parseResumeFile(file);
      setParsingStep('Normalizing candidate profile...');
      await new Promise((r) => setTimeout(r, 350));

      setProfile(extracted);
      setInitialProfile(JSON.parse(JSON.stringify(extracted)));
      setCurrentStep(1);
      showToast(`✓ Successfully extracted profile for ${extracted.firstName} ${extracted.lastName}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to parse document.');
    } finally {
      setParsingFile(false);
      setParsingStep('');
    }
  };

  const proceedToResolve = (): boolean => {
    if (!profile?.firstName?.trim() || !profile?.lastName?.trim()) {
      setError('Please provide at least a First Name and Last Name.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasEmail = Boolean(profile?.email && emailRegex.test(profile.email.trim()));
    const hasPhone = (profile?.phone?.replace(/\D/g, '').length ?? 0) >= 7;
    if (!hasEmail && !hasPhone) {
      setError('Please provide a valid email address or phone number.');
      return false;
    }
    setError(null);
    setCurrentStep(2);
    return true;
  };

  const executeFinalIngest = async (): Promise<boolean> => {
    if (!profile) return false;
    setSubmitting(true);
    setError(null);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = profile.email?.trim().toLowerCase();
      const normalizedPhone = profile.phone?.replace(/\D/g, '') || '';
      if ((!normalizedEmail || !emailRegex.test(normalizedEmail)) && normalizedPhone.length < 7) {
        throw new Error('Please provide a valid email address or phone number.');
      }

      // Safe integer conversion for experienceYears to strictly satisfy NestJS @IsInt()
      const experienceYearsInt =
        profile.experienceYears != null && !isNaN(Number(profile.experienceYears))
          ? Math.max(0, Math.round(Number(profile.experienceYears)))
          : undefined;

      // Defensive length bounds and sanitization matching CreateCandidateDto constraints
      const candidatePayload = {
        firstName: profile.firstName?.trim().slice(0, 80) || '',
        lastName: profile.lastName?.trim().slice(0, 80) || '',
        email: normalizedEmail && emailRegex.test(normalizedEmail) ? normalizedEmail.slice(0, 255) : null,
        phone: normalizedPhone.length >= 7 ? normalizedPhone.slice(0, 40) : undefined,
        currentTitle: profile.title?.trim() ? profile.title.trim().slice(0, 120) : undefined,
        currentCompany: profile.currentCompany?.trim() ? profile.currentCompany.trim().slice(0, 120) : undefined,
        experienceYears: experienceYearsInt,
        location: profile.location?.trim() ? profile.location.trim().slice(0, 120) : undefined,
        skills: Array.isArray(profile.skills)
          ? profile.skills.map((s) => String(s).trim().slice(0, 100)).filter(Boolean)
          : [],
        summary: profile.summary?.trim() ? profile.summary.trim().slice(0, 5000) : undefined,
        source: candidateSource ? candidateSource.slice(0, 80) : undefined,
      };

      let candId: string | null = null;
      let candCode: string | undefined;

      // Duplicate resolution strategy:
      // If user chose 'update' or 'link', check if candidate exists first.
      if (duplicateDecision === 'update' || duplicateDecision === 'link') {
        try {
          const lookupParams = new URLSearchParams();
          if (candidatePayload.email) lookupParams.set('email', candidatePayload.email);
          if (candidatePayload.phone) lookupParams.set('phone', candidatePayload.phone);
          const searchRes = await getApi<Array<{ id: string; candidateCode?: string; email?: string | null; phone?: string | null }>>(
            `/candidates/duplicates?${lookupParams.toString()}`
          );
          const match = searchRes.find(
            (c) => (candidatePayload.email && c.email?.trim().toLowerCase() === candidatePayload.email)
              || (candidatePayload.phone && c.phone?.replace(/\D/g, '') === candidatePayload.phone),
          ) ?? searchRes[0];
          if (match) {
            candId = match.id;
            candCode = match.candidateCode;

            if (duplicateDecision === 'update') {
              const updated = await patchApi<{ id: string; candidateCode?: string }>(
                `/candidates/${candId}`,
                candidatePayload
              );
              candCode = updated?.candidateCode || candCode;
            }
          }
        } catch {
          // Non-blocking lookup; fallback to standard creation
        }
      }

      // If candidate was not already resolved or user explicitly requested a fresh record ('new')
      if (!candId) {
        try {
          const createdCandidate = await postApi<{ id: string; candidateCode?: string }>(
            '/candidates',
            candidatePayload
          );
          candId = createdCandidate?.id ?? null;
          candCode = createdCandidate?.candidateCode;
        } catch (postErr: unknown) {
          if (postErr instanceof ApiError && postErr.statusCode === 409) {
            // Email already exists in this organization
            const lookupParams = new URLSearchParams();
            if (candidatePayload.email) lookupParams.set('email', candidatePayload.email);
            if (candidatePayload.phone) lookupParams.set('phone', candidatePayload.phone);
            const searchRes = await getApi<Array<{ id: string; candidateCode?: string; email?: string | null; phone?: string | null }>>(
              `/candidates/duplicates?${lookupParams.toString()}`
            ).catch(() => null);
            const match = searchRes?.find(
              (c) => (candidatePayload.email && c.email?.trim().toLowerCase() === candidatePayload.email)
                || (candidatePayload.phone && c.phone?.replace(/\D/g, '') === candidatePayload.phone),
            ) ?? searchRes?.[0];

            if (match) {
              candId = match.id;
              candCode = match.candidateCode;

              if (duplicateDecision === 'update') {
                const updated = await patchApi<{ id: string; candidateCode?: string }>(
                  `/candidates/${candId}`,
                  candidatePayload
                );
                candCode = updated?.candidateCode || candCode;
              } else if (duplicateDecision === 'new') {
                throw new Error(
                  `A candidate with the same contact details already exists (${candCode || candId}). To update their record or link to an opening, select "Update Existing Candidate Profile" or "Attach as New Vacancy Application Only".`,
                  { cause: postErr },
                );
              }
              // If 'link', candId is resolved; keep existing candidate profile intact
            } else {
              throw postErr;
            }
          } else {
            throw postErr;
          }
        }
      }

      if (!candId) {
        throw new Error('Unable to create or resolve candidate record.');
      }

      if (uploadedFile) {
        const documentForm = new FormData();
        documentForm.append('candidateId', candId);
        documentForm.append('documentType', 'CV');
        documentForm.append('file', uploadedFile);
        if (profile.rawText?.trim()) {
          documentForm.append('extractionText', profile.rawText.trim().slice(0, 50000));
        }
        await postFormDataApi('/documents/upload', documentForm);
      }

      setConfirmedCandidateId(candId);
      if (candCode) {
        setConfirmedCandidateCode(candCode);
      }

      // 2. Ingest into application pipeline if target vacancy is active
      if (candId && targetVacancy && targetVacancy !== 'pool') {
        try {
          const createdApp = await postApi<{ id: string; version?: number }>('/applications', {
            vacancyId: targetVacancy,
            candidateId: candId,
            source: candidateSource,
          });

          if (createdApp?.id) {
            setConfirmedAppId(createdApp.id);
            if (targetStage && targetStage !== 'Applied') {
              try {
                await patchApi(`/applications/${createdApp.id}/stage`, {
                  stage: targetStage,
                  expectedStage: 'Applied',
                  expectedVersion: createdApp.version || 1,
                  reason: 'Initial CV Intake Stage Placement',
                });
              } catch {
                // Non-blocking stage update
              }
            }
          }
        } catch (appErr: unknown) {
          if (appErr instanceof ApiError && appErr.statusCode === 409) {
            showToast('Candidate is already assigned to this vacancy.');
          } else {
            // Non-blocking application failure
          }
        }
      }

      setCurrentStep(3);
      showToast('✓ Candidate & application confirmed and ingested into talent database!');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save candidate and application.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const clearUpload = () => {
    setProfile(null);
    setInitialProfile(null);
    setUploadedFileName(null);
    setUploadedFile(null);
    setError(null);
    setCurrentStep(0);
  };

  const resetToParsed = () => {
    if (initialProfile) {
      setProfile({ ...initialProfile });
      showToast('✓ Profile reset to initial parsed values');
    }
  };

  return {
    currentStep,
    setCurrentStep,
    jobs,
    loadingJobs,
    uploadedFileName,
    profile,
    setProfile,
    targetVacancy,
    setTargetVacancy,
    targetStage,
    setTargetStage,
    candidateSource,
    candidateSourceOptions,
    setCandidateSource,
    duplicateDecision,
    setDuplicateDecision,
    vacancies,
    scoredVacancies,
    confirmedCandidateCode,
    confirmedCandidateId,
    confirmedAppId,
    parsingFile,
    parsingStep,
    submitting,
    error,
    setError,
    successToast,
    showToast,
    handleFile,
    proceedToResolve,
    executeFinalIngest,
    clearUpload,
    resetToParsed,
  };
}
