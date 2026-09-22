import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import { SkillTagsOverflow } from '../components/candidate/SkillTagsOverflow';
import { Modal } from '../components/Modal';
import { useToast } from '../components/ui/ToastContext';
import { CandidateFitScorecard } from '../components/candidate/CandidateFitScorecard';
import { EditPositionRequirementsModal } from '../components/vacancy/EditPositionRequirementsModal';
import { calculateCandidateFitScore, type CriteriaBreakdown } from '@recruitflow/validation';
import type { Candidate, Vacancy } from '@recruitflow/contracts';
import './PageEnhancementsV2.css';

interface ScoredBenchCandidate {
  candidate: Candidate;
  fit: CriteriaBreakdown;
}

export function TalentPoolPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { show } = useToast();

  // Positions & Vacancies from DB
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('');
  const [benchCandidates, setBenchCandidates] = useState<Candidate[]>([]);

  // Filters for Sourcing Bench
  const [benchSearch, setBenchSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'high' | 'moderate' | 'gap'>('all');
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Edit Position Requirements Modal
  const [isEditRequirementsOpen, setIsEditRequirementsOpen] = useState(false);

  // Fast-Track Modal state
  const [fastTrackTarget, setFastTrackTarget] = useState<{
    candidate: Candidate;
    fit: CriteriaBreakdown;
  } | null>(null);
  const [fastTrackStage, setFastTrackStage] = useState<string>('Screening');
  const [fastTrackNote, setFastTrackNote] = useState('');
  const [isFastTracking, setIsFastTracking] = useState(false);

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [vacsRes, candsRes] = await Promise.all([
        getApi<Vacancy[] | { data: Vacancy[] }>('/vacancies'),
        getApi<{ data?: Candidate[] } | Candidate[]>('/candidates?pageSize=100'),
      ]);

      const vacList = Array.isArray(vacsRes) ? vacsRes : vacsRes?.data || [];
      const candList = Array.isArray(candsRes) ? candsRes : candsRes?.data || [];

      setVacancies(vacList);
      setBenchCandidates(candList);

      // Check query params for initial selection
      const queryVacId = searchParams.get('vacancyId');
      const queryPosId = searchParams.get('positionId');

      if (queryVacId && vacList.some((v) => v.id === queryVacId)) {
        setSelectedVacancyId(queryVacId);
      } else if (queryPosId && vacList.some((v) => v.positionId === queryPosId)) {
        const found = vacList.find((v) => v.positionId === queryPosId);
        if (found) setSelectedVacancyId(found.id);
      } else if (vacList.length > 0) {
        // Default to first open clinical position
        const defaultOpen = vacList.find((v) => v.status === 'Open') || vacList[0];
        setSelectedVacancyId(defaultOpen.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sourcing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [searchParams]);

  // Selected Target Vacancy Specification
  const selectedVacancy = useMemo(() => {
    return vacancies.find((v) => v.id === selectedVacancyId) || null;
  }, [vacancies, selectedVacancyId]);

  // Compute Empirical Match Scores across all Bench Candidates
  const scoredCandidates: ScoredBenchCandidate[] = useMemo(() => {
    if (!selectedVacancy) return [];

    const requirementsInput = {
      requiredSkills: selectedVacancy.requiredSkills || [],
      minExperienceYears: selectedVacancy.minExperienceYears ?? 3,
      location: selectedVacancy.location || undefined,
      requiredCertifications: selectedVacancy.qualifications
        ? [selectedVacancy.qualifications]
        : undefined,
    };

    return benchCandidates
      .map((c) => {
        const candidateInput = {
          skills: c.skills || [],
          experienceYears: c.experienceYears ?? undefined,
          location: c.location || undefined,
          certifications: c.certifications || [],
          currentTitle: c.currentTitle || undefined,
          summary: c.summary || (c.metadata as Record<string, unknown> | undefined)?.summary as string | undefined,
          rawText: (c as { rawText?: string }).rawText || c.summary || undefined,
          workHistory: (c.metadata as Record<string, unknown> | undefined)?.workHistory as Parameters<typeof calculateCandidateFitScore>[0]['workHistory'],
          educationHistory: (c.metadata as Record<string, unknown> | undefined)?.educationHistory as Parameters<typeof calculateCandidateFitScore>[0]['educationHistory'],
          projectHistory: (c.metadata as Record<string, unknown> | undefined)?.projectHistory as Parameters<typeof calculateCandidateFitScore>[0]['projectHistory'],
          evidenceChunks: (c.metadata as Record<string, unknown> | undefined)?.evidenceChunks as Parameters<typeof calculateCandidateFitScore>[0]['evidenceChunks'],
          responsibilities: (c.metadata as Record<string, unknown> | undefined)?.responsibilities as Parameters<typeof calculateCandidateFitScore>[0]['responsibilities'],
        };
        const fit = calculateCandidateFitScore(candidateInput, requirementsInput);
        return { candidate: c, fit };
      })
      .sort((a, b) => b.fit.score - a.fit.score);
  }, [benchCandidates, selectedVacancy]);

  // Filter scored candidates by tier and search query
  const filteredCandidates = useMemo(() => {
    return scoredCandidates.filter((item) => {
      const c = item.candidate;
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const title = (c.currentTitle || '').toLowerCase();
      const loc = (c.location || '').toLowerCase();
      const q = benchSearch.toLowerCase().trim();

      const matchesSearch = !q || fullName.includes(q) || title.includes(q) || loc.includes(q);

      const matchesTier =
        tierFilter === 'all' ||
        (tierFilter === 'high' && item.fit.matchLevel === 'high') ||
        (tierFilter === 'moderate' && item.fit.matchLevel === 'moderate') ||
        (tierFilter === 'gap' && item.fit.matchLevel === 'low');

      return matchesSearch && matchesTier;
    });
  }, [scoredCandidates, benchSearch, tierFilter]);

  // Tier Counts
  const tierCounts = useMemo(() => {
    const high = scoredCandidates.filter((i) => i.fit.matchLevel === 'high').length;
    const moderate = scoredCandidates.filter((i) => i.fit.matchLevel === 'moderate').length;
    const gap = scoredCandidates.filter((i) => i.fit.matchLevel === 'low').length;
    return { all: scoredCandidates.length, high, moderate, gap };
  }, [scoredCandidates]);

  // Handle Fast-Track to Pipeline
  const handleFastTrackSubmit = async () => {
    if (!fastTrackTarget || !selectedVacancy) return;
    setIsFastTracking(true);
    try {
      await postApi('/applications', {
        candidateId: fastTrackTarget.candidate.id,
        vacancyId: selectedVacancy.id,
        stage: fastTrackStage,
        notes: fastTrackNote ? `[Added to job]: ${fastTrackNote}` : '[Added to job]',
      });

      show({
        tone: 'success',
        title: 'Added to job',
        message: `${fastTrackTarget.candidate.firstName} ${fastTrackTarget.candidate.lastName} is now on ${selectedVacancy.title || 'this job'} at ${fastTrackStage}.`,
      });

      setFastTrackTarget(null);
      setFastTrackNote('');
    } catch (err: unknown) {
      show({
        tone: 'error',
        title: 'Could not add candidate',
        message: err instanceof Error ? err.message : 'Could not add this person to the job.',
      });
    } finally {
      setIsFastTracking(false);
    }
  };

  const handlePositionRequirementsSaved = (updated: {
    requiredSkills: string[];
    minExperienceYears: number | null;
    location: string;
    department: string;
    qualifications?: string | null;
    jobSummary?: string | null;
  }) => {
    setVacancies((prev) =>
      prev.map((v) =>
        v.id === selectedVacancyId
          ? {
              ...v,
              requiredSkills: updated.requiredSkills,
              minExperienceYears: updated.minExperienceYears,
              location: updated.location,
              department: updated.department,
              qualifications: updated.qualifications ?? v.qualifications,
              jobSummary: updated.jobSummary ?? v.jobSummary,
            }
          : v
      )
    );
    show({
      tone: 'success',
      title: 'Requirements saved',
      message: 'Job requirements updated. Fit scores were recalculated.',
    });
  };

  return (
    <PageFrame
      title="Talent pool"
      description="Rank people against one job, then add the best fit."
      actions={
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => navigate('/vacancies?tab=catalog')}
        >
          <Icon name="briefcase" size={14} />
          <span>Jobs</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-sm">
            {error}
          </div>
        )}

        {/* Position Target Selector Bar (Dual-Theme Enterprise Benchmark) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {vacancies.length} open {vacancies.length === 1 ? 'job' : 'jobs'}
              </p>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                {selectedVacancy?.title || selectedVacancy?.position?.title || 'Choose a job'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[240px] sm:min-w-[320px]">
                <select
                  aria-label="Job to match against"
                  value={selectedVacancyId}
                  onChange={(e) => setSelectedVacancyId(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white py-1">
                      {v.title || v.position?.title || 'Untitled job'} ({v.vacancyCode})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400">
                  <Icon name="chevron-down" size={14} />
                </div>
              </div>

              {selectedVacancy && (
                <button
                  type="button"
                  onClick={() => setIsEditRequirementsOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <Icon name="edit" size={13} />
                  <span>Edit requirements</span>
                </button>
              )}
            </div>
          </div>

          {selectedVacancy && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {selectedVacancy.department || 'Department not set'}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {selectedVacancy.minExperienceYears ?? 0}+ years
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {selectedVacancy.location || 'Location not set'}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {tierCounts.high} strong · {tierCounts.moderate} possible
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Required skills</span>
                {(!selectedVacancy.requiredSkills || selectedVacancy.requiredSkills.length === 0) ? (
                  <span className="text-[11px] text-slate-500">None yet. Use Edit requirements.</span>
                ) : (
                  selectedVacancy.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sourcing Bench Candidate Pool */}
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Icon name="search" size={15} />
              </div>
              <input
                type="text"
                value={benchSearch}
                onChange={(e) => setBenchSearch(e.target.value)}
                placeholder="Search by name, title, skill, or city"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
              />
            </div>

            {/* Match Tier Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto">
              <button
                type="button"
                onClick={() => setTierFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  tierFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({tierCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setTierFilter('high')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  tierFilter === 'high'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <span>Strong</span>
                <span className="text-[10px] font-semibold opacity-90">
                  {tierCounts.high}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTierFilter('moderate')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  tierFilter === 'moderate'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                <span>Possible</span>
                <span className="text-[10px] font-semibold opacity-90">
                  {tierCounts.moderate}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTierFilter('gap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  tierFilter === 'gap'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <span>Gap</span>
                <span className="text-[10px] font-semibold opacity-90">
                  {tierCounts.gap}
                </span>
              </button>
            </div>
          </div>

          {/* Candidates List with Real-Time Fit Scores */}
          {loading ? (
            <PageState kind="loading" title="Loading talent pool" />
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Icon name="search" size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No matches
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Try another filter or search.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCandidates.map(({ candidate, fit }) => {
                const isExpanded = expandedCandidateId === candidate.id;
                const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';

                return (
                  <div
                    key={candidate.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Avatar & Candidate Info */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {(candidate.firstName?.[0] || 'C') + (candidate.lastName?.[0] || 'D')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {fullName}
                            </h3>
                            <CandidateFitScorecard
                              variant="badge"
                              breakdown={fit}
                            />
                            {candidate.certifications && candidate.certifications.length > 0 && (
                              <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                {candidate.certifications[0]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                            {[candidate.currentTitle, candidate.experienceYears != null ? `${candidate.experienceYears} yrs` : null, candidate.location]
                              .filter(Boolean)
                              .join(' · ') || 'Role not set'}
                          </p>
                          {/* Candidate Skills Chips */}
                          <SkillTagsOverflow
                            className="mt-2.5 gap-1.5"
                            skills={candidate.skills || []}
                            prioritySkills={fit.breakdown.skills.matched}
                            limit={5}
                          />
</div>
                      </div>

                      {/* Right: Quick Action CTAs */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => setExpandedCandidateId(isExpanded ? null : candidate.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                        >
                          <Icon name="chevron-down" size={13} className={isExpanded ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                          <span>{isExpanded ? 'Hide fit' : 'View fit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFastTrackTarget({ candidate, fit })}
                          className="inline-flex min-h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                        >
                          Add to job
                        </button>
                      </div>
                    </div>

                    {/* Expandable Scorecard Breakdown */}
                    {isExpanded && selectedVacancy && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <CandidateFitScorecard
                          variant="full"
                          breakdown={fit}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fast-Track to Pipeline Modal */}
      {fastTrackTarget && selectedVacancy && (
        <Modal
          isOpen={Boolean(fastTrackTarget)}
          onClose={() => setFastTrackTarget(null)}
          title="Add to job"
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {fastTrackTarget.candidate.firstName} {fastTrackTarget.candidate.lastName}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedVacancy.title || 'Job'} · {selectedVacancy.vacancyCode}
                </p>
              </div>
              <CandidateFitScorecard
                variant="badge"
                breakdown={fastTrackTarget.fit}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Stage
              </label>
              <select
                value={fastTrackStage}
                onChange={(e) => setFastTrackStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Screening">Screening</option>
                <option value="Interview">Interview</option>
                <option value="Applied">Applied</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Note
              </label>
              <textarea
                rows={2}
                value={fastTrackNote}
                onChange={(e) => setFastTrackNote(e.target.value)}
                placeholder="Optional note for the recruiter"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFastTrackTarget(null)}
                disabled={isFastTracking}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFastTrackSubmit}
                disabled={isFastTracking}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow disabled:opacity-50 transition cursor-pointer"
              >
                {isFastTracking ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" size={13} />
                    <span>Add to job</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Position Requirements Modal */}
      {selectedVacancy && (
        <EditPositionRequirementsModal
          isOpen={isEditRequirementsOpen}
          onClose={() => setIsEditRequirementsOpen(false)}
          vacancyId={selectedVacancy.id}
          positionTitle={selectedVacancy.title || selectedVacancy.position?.title || 'Position'}
          positionCode={selectedVacancy.vacancyCode}
          initialSkills={selectedVacancy.requiredSkills || []}
          initialMinExp={selectedVacancy.minExperienceYears ?? 3}
          initialLocation={selectedVacancy.location || ''}
          initialDepartment={selectedVacancy.department || ''}
          initialQualifications={selectedVacancy.qualifications}
          initialJobSummary={selectedVacancy.jobSummary}
          onSaved={handlePositionRequirementsSaved}
        />
      )}
    </PageFrame>
  );
}

export const SmartSourcingMatchPage = TalentPoolPage;
