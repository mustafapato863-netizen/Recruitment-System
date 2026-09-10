import React, { useMemo } from 'react';
import type { Vacancy } from '@recruitflow/contracts';
import { calculateCandidateFitScore } from '@recruitflow/validation';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import type { ExtractedCandidate } from '../../utils/resumeParser';
import type { DuplicateCandidate, ScoredVacancy } from '../../hooks/useCVIntakeFlow';

interface CVMatchAssignerProps {
  profile: ExtractedCandidate;
  vacancies: Vacancy[];
  scoredVacancies?: ScoredVacancy[];
  targetVacancy: string;
  setTargetVacancy: (v: string) => void;
  targetStage: string;
  setTargetStage: (s: string) => void;
  candidateSource: string;
  candidateSourceOptions: string[];
  setCandidateSource: (s: string) => void;
  duplicateDecision: 'update' | 'new' | 'link';
  setDuplicateDecision: (d: 'update' | 'new' | 'link') => void;
  duplicateCandidates: DuplicateCandidate[];
  checkingDuplicates: boolean;
  duplicateCheckError: string | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export const CVMatchAssigner: React.FC<CVMatchAssignerProps> = ({
  profile,
  vacancies,
  scoredVacancies: propScoredVacancies,
  targetVacancy,
  setTargetVacancy,
  targetStage,
  setTargetStage,
  candidateSource,
  candidateSourceOptions,
  setCandidateSource,
  duplicateDecision,
  setDuplicateDecision,
  duplicateCandidates,
  checkingDuplicates,
  duplicateCheckError,
  submitting,
  onBack,
  onConfirm,
}) => {
  // Compute scored vacancies if not provided via props
  const scoredList = useMemo<ScoredVacancy[]>(() => {
    if (propScoredVacancies && propScoredVacancies.length > 0) {
      return propScoredVacancies;
    }

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

    scored.sort((a, b) => b.fitResult.score - a.fitResult.score);
    return scored;
  }, [propScoredVacancies, profile, vacancies]);

  // Active vacancy fit calculation
  const activeScored = useMemo(() => {
    if (!targetVacancy || targetVacancy === 'pool') return null;
    return scoredList.find((s) => s.vacancy.id === targetVacancy) || null;
  }, [targetVacancy, scoredList]);

  const topRecommendations = useMemo(() => {
    return scoredList.slice(0, 3);
  }, [scoredList]);

  const hasDuplicateCandidates = duplicateCandidates.length > 0;
  const canChooseExistingCandidate = hasDuplicateCandidates && !checkingDuplicates;
  const duplicatePanelTone = checkingDuplicates
    ? 'border-blue-200/80 bg-blue-50/60 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200'
    : hasDuplicateCandidates
    ? 'border-amber-200/80 bg-amber-50/60 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'
    : duplicateCheckError
    ? 'border-orange-200/80 bg-orange-50/60 text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200'
    : 'border-emerald-200/80 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200';
  const duplicateStatusTitle = checkingDuplicates
    ? 'Checking candidate identity'
    : hasDuplicateCandidates
    ? 'Potential duplicate found'
    : duplicateCheckError
    ? 'Duplicate check unavailable'
    : 'No duplicate found';
  const duplicateStatusDescription = checkingDuplicates
    ? 'Checking existing candidates by email and phone before you save this CV.'
    : hasDuplicateCandidates
    ? 'A matching candidate already exists in your organization. Choose whether to update that profile, create a separate identity, or link this CV to an application.'
    : duplicateCheckError
    ? duplicateCheckError
    : 'No existing candidate matched this CV’s email or phone. A new candidate profile will be created.';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
      {/* Header Bar */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              Step 3 of 4: Resolve & Match
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {profile.firstName} {profile.lastName}
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Duplicate Resolution & AI Vacancy Matching
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Resolve identity conflicts and select the best-fitting open position recommended by the clinical match engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to Edit</span>
          </button>
          <button
            type="button"
            disabled={submitting || checkingDuplicates}
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20 disabled:opacity-50"
          >
            {submitting || checkingDuplicates ? <Spinner size={14} /> : <Icon name="check" size={14} />}
            <span>{checkingDuplicates ? 'Checking candidate…' : 'Confirm & Ingest Candidate'}</span>
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Duplicate Identity Resolution */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              checkingDuplicates
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600'
                : hasDuplicateCandidates
                ? 'bg-amber-50 dark:bg-amber-950 text-amber-600'
                : duplicateCheckError
                ? 'bg-orange-50 dark:bg-orange-950 text-orange-600'
                : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
            }`}>
              <Icon name={checkingDuplicates ? 'clock' : hasDuplicateCandidates ? 'copy' : duplicateCheckError ? 'alert-triangle' : 'check-circle'} size={13} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {duplicateStatusTitle}
            </h3>
          </div>

          <div className={`p-3.5 rounded-xl border text-xs ${duplicatePanelTone}`}>
            <div className="flex items-center gap-2 font-bold">
              <Icon name={checkingDuplicates ? 'clock' : hasDuplicateCandidates ? 'copy' : duplicateCheckError ? 'alert-triangle' : 'check-circle'} size={14} />
              <span>{checkingDuplicates ? 'Checking duplicate identity' : hasDuplicateCandidates ? `${duplicateCandidates.length} matching candidate${duplicateCandidates.length === 1 ? '' : 's'} found` : duplicateStatusTitle}</span>
            </div>
            <p className="mt-1 opacity-90">{duplicateStatusDescription}</p>

            {hasDuplicateCandidates && (
              <div className="mt-3 pt-3 border-t border-amber-200/80 dark:border-amber-900/50 space-y-2">
                <span className="font-bold block text-[10px] uppercase tracking-wider">Existing candidate match</span>
                {duplicateCandidates.slice(0, 3).map((candidate) => (
                  <div key={candidate.id} className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/50 border border-amber-200/70 dark:border-amber-900/50">
                    <strong className="text-slate-800 dark:text-slate-200 block">
                      {[candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Candidate profile'}
                    </strong>
                    <span className="text-[10.5px] opacity-80 block mt-0.5">
                      {candidate.candidateCode || 'Existing candidate'}
                    </span>
                  </div>
                ))}
                {duplicateCandidates.length > 3 && (
                  <span className="text-[10px] opacity-80 block">+{duplicateCandidates.length - 3} more matches</span>
                )}
              </div>
            )}

            <div className={`mt-3 pt-3 border-t p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 ${
              hasDuplicateCandidates || duplicateCheckError
                ? 'border-t-amber-200/80 dark:border-t-amber-900/50'
                : 'border-t-emerald-200/80 dark:border-t-emerald-900/50'
            }`}>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase tracking-wider">
                Parsed CV record
              </span>
              <strong className="text-slate-800 dark:text-slate-200 block mt-0.5">
                {profile.firstName} {profile.lastName}
              </strong>
              <span className="text-emerald-700 dark:text-emerald-300 block text-[10.5px]">
                {profile.title || 'Role not specified'}
              </span>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                {profile.experienceYears === undefined ? 'Experience not reported' : `${profile.experienceYears} Years Experience`}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {canChooseExistingCandidate && (
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  duplicateDecision === 'update'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="dup-decision"
                  checked={duplicateDecision === 'update'}
                  onChange={() => setDuplicateDecision('update')}
                  className="mt-1 text-blue-600"
                />
                <div>
                  <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                    Update Existing Candidate Profile (Recommended)
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enriches the matched profile with newly parsed experience, skills, and the current CV document.
                  </span>
                </div>
              </label>
            )}

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition ${
                checkingDuplicates
                  ? 'border-slate-200 dark:border-slate-700 opacity-60 cursor-wait'
                  : duplicateDecision === 'new'
                  ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20 cursor-pointer'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="dup-decision"
                checked={duplicateDecision === 'new'}
                disabled={checkingDuplicates}
                onChange={() => setDuplicateDecision('new')}
                className="mt-1 text-blue-600"
              />
              <div>
                <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                  Create New Candidate Profile
                </strong>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Creates a new candidate identity. Use this when the CV belongs to a different person or no match was found.
                </span>
              </div>
            </label>

            {canChooseExistingCandidate && (
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  duplicateDecision === 'link'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="dup-decision"
                  checked={duplicateDecision === 'link'}
                  onChange={() => setDuplicateDecision('link')}
                  className="mt-1 text-blue-600"
                />
                <div>
                  <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                    Attach as New Vacancy Application Only
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Leaves the matched candidate profile unchanged and registers this CV against the selected opening.
                  </span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Right Card: AI Vacancy Assignment & Live Match Scorecard */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                <Icon name="briefcase" size={13} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Target Vacancy & Match Recommendations
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <Icon name="sparkles" size={10} />
              AI-Matched
            </span>
          </div>

          <div className="space-y-4">
            {/* 1. Interactive Recommended Position Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Icon name="sparkles" size={13} className="text-blue-500" />
                  <span>Choose Best-Fit Open Position:</span>
                </span>
                <span className="text-[11px] font-medium text-slate-400">1-click select</span>
              </div>

              {topRecommendations.map(({ vacancy: v, fitResult }, index) => {
                const isSelected = targetVacancy === v.id;
                const isBestFit = index === 0 && fitResult.score >= 50;

                return (
                  <div
                    key={v.id}
                    onClick={() => setTargetVacancy(v.id)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer relative transform hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/25 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-slate-700 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {isSelected && <Icon name="check" size={10} className="stroke-[3]" />}
                          </div>
                          <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            [{v.vacancyCode}]
                          </span>
                          <strong className="text-xs font-bold text-slate-900 dark:text-white">
                            {v.position?.title || v.title || 'Requisition'}
                          </strong>
                          {isBestFit && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <Icon name="sparkles" size={9} />
                              Top Recommended
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap pl-6">
                          <span className="flex items-center gap-1">
                            <Icon name="building" size={11} />
                            <span>{v.branch?.name || v.location || 'Location not set'}</span>
                          </span>
                          {v.department && (
                            <>
                              <span>&bull;</span>
                              <span>{v.department}</span>
                            </>
                          )}
                        </div>

                        {/* Matched & Missing Skills Chips */}
                        <div className="pl-6 space-y-1">
                          {fitResult.breakdown.skills.matched.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {fitResult.breakdown.skills.matched.slice(0, 3).map((skill) => (
                                <span
                                  key={skill}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                >
                                  <Icon name="check" size={9} />
                                  <span>{skill}</span>
                                </span>
                              ))}
                              {fitResult.breakdown.skills.matched.length > 3 && (
                                <span className="text-[10px] text-slate-400 font-bold self-center">
                                  +{fitResult.breakdown.skills.matched.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {fitResult.breakdown.skills.missing.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {fitResult.breakdown.skills.missing.slice(0, 2).map((skill) => (
                                <span
                                  key={skill}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80"
                                  title="Required skill not detected in candidate profile"
                                >
                                  <span className="text-amber-500 font-bold">−</span>
                                  <span>{skill}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black border shadow-2xs ${
                            fitResult.score >= 85
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : fitResult.score >= 60
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {fitResult.score}% Fit
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            <Icon name="check" size={11} />
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Talent Pool Option */}
              <div
                onClick={() => setTargetVacancy('pool')}
                className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between transform hover:-translate-y-0.5 hover:shadow-md ${
                  targetVacancy === 'pool'
                    ? 'border-purple-600 dark:border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 ring-2 ring-purple-500/25 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                      targetVacancy === 'pool'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {targetVacancy === 'pool' && <Icon name="check" size={10} className="stroke-[3]" />}
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <Icon name="database" size={13} />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                      General Talent Pool Bench
                    </strong>
                    <span className="text-[10.5px] text-slate-400 block">
                      Ingest candidate without assigning to a specific opening; ready for future sourcing
                    </span>
                  </div>
                </div>
                {targetVacancy === 'pool' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400">
                    <Icon name="check" size={12} />
                    Selected
                  </span>
                )}
              </div>
            </div>

            {/* Alternative Dropdown for All Openings */}
            <div className="pt-1">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Or choose from all {scoredList.length} requisitions:
              </label>
              <select
                value={targetVacancy}
                onChange={(e) => setTargetVacancy(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition shadow-2xs"
              >
                {scoredList.map(({ vacancy: v, fitResult }) => (
                  <option key={v.id} value={v.id}>
                    [{fitResult.score}% Fit] [{v.vacancyCode}] {v.position?.title || v.title || 'Requisition'} {v.branch?.name ? `(${v.branch.name})` : ''}
                  </option>
                ))}
                <option value="pool">📦 General Talent Pool (No active vacancy)</option>
              </select>
            </div>

            {/* 2. Live Dynamic Fit Scorecard for Selected Position */}
            {activeScored && (
              <div className="p-4 sm:p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/60 via-white to-blue-50/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-blue-950/20 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        {activeScored.vacancy.position?.title || activeScored.vacancy.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Live qualification & clinical requirement breakdown
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                      {activeScored.fitResult.score}%
                    </span>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Match Fit
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeScored.fitResult.score >= 80
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : activeScored.fitResult.score >= 60
                        ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}
                    style={{ width: `${activeScored.fitResult.score}%` }}
                  />
                </div>

                {/* 4-Criteria Scorecard Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Skills Match</span>
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-100 block mt-0.5">
                      {activeScored.fitResult.breakdown.skills.percentage}%
                    </strong>
                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {activeScored.fitResult.breakdown.skills.matched.length} Matched
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Experience</span>
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-100 block mt-0.5">
                      {profile.experienceYears === undefined ? 'Not reported' : `${profile.experienceYears} Yrs`}
                    </strong>
                    <span
                      className={`block text-[10px] font-bold mt-0.5 ${
                        activeScored.fitResult.breakdown.experience.met
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {activeScored.fitResult.breakdown.experience.met
                        ? `✓ Req (${activeScored.vacancy.minExperienceYears ?? 0}y) Met`
                        : `Gap (Req ${activeScored.vacancy.minExperienceYears ?? 0}y)`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Licensure</span>
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-100 block mt-0.5">
                      {profile.certifications?.length || 0} Listed
                    </strong>
                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {activeScored.fitResult.breakdown.certifications.met ? '✓ Mandatory Met' : 'Needs Review'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Location</span>
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-100 block mt-0.5 truncate">
                      {activeScored.vacancy.branch?.name || activeScored.vacancy.location || 'Location not set'}
                    </strong>
                    <span
                      className={`block text-[10px] font-bold mt-0.5 ${
                        activeScored.fitResult.breakdown.location.met
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {activeScored.fitResult.breakdown.location.met ? '✓ Branch Matched' : 'Relocation Eligible'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2">
                  <Icon name="sparkles" size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 italic leading-relaxed">
                    "{activeScored.fitResult.summaryText}"
                  </p>
                </div>
              </div>
            )}

            {/* Starting Stage & Source selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Starting Pipeline Stage
                </label>
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Screening">Screening (CV Review)</option>
                  <option value="Interview">Interview Round 1</option>
                  <option value="Assessment">Technical / Clinical Assessment</option>
                  <option value="Talent Pool">Talent Pool (Ready for Sourcing)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Candidate Source
                </label>
                <select
                  value={candidateSource}
                  onChange={(e) => setCandidateSource(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {candidateSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
