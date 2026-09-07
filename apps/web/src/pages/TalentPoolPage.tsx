import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
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
        notes: fastTrackNote ? `[Smart Sourcing Fast-Track]: ${fastTrackNote}` : '[Smart Sourcing Fast-Track]',
      });

      show({
        tone: 'success',
        title: 'Candidate Fast-Tracked!',
        message: `${fastTrackTarget.candidate.firstName} ${fastTrackTarget.candidate.lastName} was submitted into ${selectedVacancy.title || 'the position'} at ${fastTrackStage} stage.`,
      });

      setFastTrackTarget(null);
      setFastTrackNote('');
    } catch (err: unknown) {
      show({
        tone: 'error',
        title: 'Fast-Track Failed',
        message: err instanceof Error ? err.message : 'Could not submit candidate to application pipeline.',
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
      title: 'Requirements Saved',
      message: 'Position benchmark requirements updated. Fit scores re-calculated in real time.',
    });
  };

  return (
    <PageFrame
      eyebrow="Talent & Sourcing"
      title="Smart Sourcing & Match Engine"
      description="Position-driven candidate screening, empirical % fit scorecards, and instant pipeline fast-tracking"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => navigate('/vacancies?tab=catalog')}
        >
          <Icon name="briefcase" size={14} />
          <span>Full Positions Directory</span>
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
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-sky-50/95 via-white to-emerald-50/90 dark:from-slate-900/95 dark:via-[#0c182a]/95 dark:to-slate-900/95 text-slate-900 dark:text-white shadow-sm dark:shadow-xl border border-sky-200/80 dark:border-cyan-500/25 relative overflow-hidden transition-colors">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859]" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-sky-100 dark:bg-cyan-500/20 text-sky-800 dark:text-cyan-300 border border-sky-300/80 dark:border-cyan-400/30">
                  Target Requisition Benchmark
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {vacancies.length} Positions Active in DB
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Compare Candidate Bench Against Specific Position
              </h2>
            </div>

            {/* Position Dropdown */}
            <div className="flex items-center gap-3">
              <div className="relative min-w-[280px] sm:min-w-[340px]">
                <select
                  aria-label="Select Target Position for Match Benchmark"
                  value={selectedVacancyId}
                  onChange={(e) => setSelectedVacancyId(e.target.value)}
                  className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-cyan-400 shadow-xs appearance-none cursor-pointer"
                >
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white py-1">
                      {v.title || v.position?.title || 'Untitled Position'} ({v.vacancyCode})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-3.5 text-slate-400">
                  <Icon name="chevron-down" size={14} />
                </div>
              </div>

              {selectedVacancy && (
                <button
                  type="button"
                  onClick={() => setIsEditRequirementsOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-110 text-white text-xs font-black transition shadow-sm cursor-pointer whitespace-nowrap"
                  title="Edit position required skills, experience, location, and certifications"
                >
                  <Icon name="edit" size={13} />
                  <span>Edit Specs</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Position Requirements Specs Banner */}
          {selectedVacancy && (
            <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-700/60 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 shadow-2xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1 text-[11px]">Clinical Department</span>
                <span className="text-slate-900 dark:text-slate-100 font-extrabold text-xs">
                  {selectedVacancy.department || 'General Clinical'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 shadow-2xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1 text-[11px]">Min Experience Benchmark</span>
                <span className="text-amber-700 dark:text-amber-300 font-extrabold text-xs">
                  ⏱️ {selectedVacancy.minExperienceYears ?? 3}+ Years Required
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 shadow-2xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1 text-[11px]">Hospital Facility Location</span>
                <span className="text-slate-900 dark:text-slate-100 font-extrabold text-xs">
                  📍 {selectedVacancy.location || 'SGH Riyadh Hospital'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 shadow-2xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1 text-[11px]">Candidate Match Yield</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
                  🎯 {tierCounts.high} High • {tierCounts.moderate} Moderate
                </span>
              </div>

              {/* Required Skills Chips */}
              <div className="md:col-span-4 flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-slate-500 dark:text-slate-400 font-bold mr-1 text-[11px]">Required Skills:</span>
                {(!selectedVacancy.requiredSkills || selectedVacancy.requiredSkills.length === 0) ? (
                  <span className="text-slate-400 italic text-[11px]">No specific skills listed. Click "Edit Specs" to configure.</span>
                ) : (
                  selectedVacancy.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 dark:bg-slate-800 text-sky-900 dark:text-cyan-200 border border-sky-200/90 dark:border-slate-700 shadow-2xs"
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
                placeholder="Search candidates by name, current title, skills, or city..."
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
                All Bench ({tierCounts.all})
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
                <span>High Match ≥80%</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/30 text-white font-extrabold">
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
                <span>Moderate 60-79%</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-white font-extrabold">
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
                <span>Skill Gaps &lt;60%</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-white font-extrabold">
                  {tierCounts.gap}
                </span>
              </button>
            </div>
          </div>

          {/* Candidates List with Real-Time Fit Scores */}
          {loading ? (
            <PageState kind="loading" title="Loading candidate bench and calculating % fit..." />
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Icon name="search" size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No candidates found in this tier
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Try switching the match tier filter or search query to see other bench candidates.
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
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 transition-all duration-200 shadow-xs hover:shadow-md"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Avatar & Candidate Info */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 via-teal-500/20 to-emerald-500/20 text-sky-800 dark:text-cyan-300 font-black text-sm flex items-center justify-center border border-sky-300/40 dark:border-cyan-500/30 shrink-0 shadow-2xs">
                          {(candidate.firstName?.[0] || 'C') + (candidate.lastName?.[0] || 'D')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-cyan-400 transition cursor-pointer">
                              {fullName}
                            </h3>
                            <CandidateFitScorecard
                              variant="badge"
                              breakdown={fit}
                            />
                            {candidate.certifications && candidate.certifications.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                                🛡️ {candidate.certifications[0]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                            {candidate.currentTitle || 'Healthcare Professional'} •{' '}
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {candidate.experienceYears ?? 0} yrs experience
                            </span>{' '}
                            • {candidate.location || 'Saudi Arabia'}
                          </p>
                          {/* Candidate Skills Chips */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {(candidate.skills || []).slice(0, 5).map((skill) => {
                              const isMatched = fit.breakdown.skills.matched.includes(skill);
                              return (
                                <span
                                  key={skill}
                                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition ${
                                    isMatched
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {isMatched ? '✓ ' : ''}{skill}
                                </span>
                              );
                            })}
                            {(candidate.skills || []).length > 5 && (
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 self-center px-1">
                                +{(candidate.skills || []).length - 5} more
                              </span>
                            )}
                          </div>
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
                          <span>{isExpanded ? 'Hide Specs' : 'Match Specs'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFastTrackTarget({ candidate, fit })}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-110 text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
                        >
                          <Icon name="sparkles" size={13} />
                          <span>Fast-Track</span>
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
          title="Fast-Track Candidate to Requisition Pipeline"
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-teal-900 dark:text-teal-200">
                  {fastTrackTarget.candidate.firstName} {fastTrackTarget.candidate.lastName}
                </h4>
                <p className="text-xs text-teal-700 dark:text-teal-400">
                  Target: {selectedVacancy.title || 'Position'} ({selectedVacancy.vacancyCode})
                </p>
              </div>
              <CandidateFitScorecard
                variant="badge"
                breakdown={fastTrackTarget.fit}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Pipeline Destination Stage
              </label>
              <select
                value={fastTrackStage}
                onChange={(e) => setFastTrackStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Screening">Screening (Recommended)</option>
                <option value="Interview">Direct to Interview</option>
                <option value="Applied">Applied Queue</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Sourcing Notes
              </label>
              <textarea
                rows={2}
                value={fastTrackNote}
                onChange={(e) => setFastTrackNote(e.target.value)}
                placeholder="e.g. Sourced from Bench with 92% clinical fit. Immediate availability."
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
                    <span>Submit to Screening</span>
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
          initialLocation={selectedVacancy.location || 'SGH Riyadh Hospital'}
          initialDepartment={selectedVacancy.department || 'Clinical Services'}
          initialQualifications={selectedVacancy.qualifications}
          initialJobSummary={selectedVacancy.jobSummary}
          onSaved={handlePositionRequirementsSaved}
        />
      )}
    </PageFrame>
  );
}

export const SmartSourcingMatchPage = TalentPoolPage;
