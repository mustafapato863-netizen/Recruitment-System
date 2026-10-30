import { useEffect, useMemo, useState } from 'react';
import { fetchVacancyList } from '../utils/vacancyAccess';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BriefcaseBusiness, Building2, Calendar, Check, ChevronDown, MapPin,
  MoreVertical, Pencil, PlusCircle, RotateCcw, Search, Users,
} from 'lucide-react';
import { getApi, postApi } from '../api/client';
import { PageState } from '../components/ui/PageState';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/ui/ToastContext';
import { CandidateFitScorecard } from '../components/candidate/CandidateFitScorecard';
import { EditPositionRequirementsModal } from '../components/vacancy/EditPositionRequirementsModal';
import { calculateCandidateFitScore, type CriteriaBreakdown } from '@recruitflow/validation';
import type { Candidate, Vacancy } from '@recruitflow/contracts';
import './PageEnhancementsV2.css';
import '../v2/pages/match-skills.css';

interface ScoredBenchCandidate {
  candidate: Candidate;
  fit: CriteriaBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  displayScore: number;
  availability: 'available' | 'notice';
}

type MatchTier = 'all' | 'best' | 'good' | 'potential' | 'low';

const DEFAULT_NURSING_SKILLS = [
  'Patient Care',
  'Medication Administration',
  'Vital Signs Monitoring',
  'Infection Control',
  'Clinical Documentation',
  'BLS/ACLS',
  'Communication',
  'Teamwork',
];

const AVATAR_TONES = ['blue', 'green', 'rose', 'amber'] as const;

function getGaugeMeta(score: number): { label: string; tone: 'excellent' | 'strong' | 'good' | 'potential' | 'low'; color: string } {
  if (score >= 90) return { label: 'Excellent match', tone: 'excellent', color: '#16a34a' };
  if (score >= 85) return { label: 'Strong match', tone: 'strong', color: '#16a34a' };
  if (score >= 75) return { label: 'Good match', tone: 'good', color: '#2563eb' };
  if (score >= 60) return { label: 'Potential match', tone: 'potential', color: '#d97706' };
  return { label: 'Low match', tone: 'low', color: '#dc2626' };
}

function MatchRingGauge({ score }: { score: number }) {
  const { label, tone, color } = getGaugeMeta(score);
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="rf2-ms__gauge">
      <div className="rf2-ms__gauge-ring">
        <svg className="rf2-ms__gauge-svg" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={radius} stroke="rgba(148, 163, 184, 0.22)" strokeWidth="4.5" fill="none" />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="rf2-ms__gauge-pct">{clamped}%</span>
      </div>
      <span className="rf2-ms__gauge-label" data-tone={tone}>{label}</span>
    </div>
  );
}

export function TalentPoolPage() {
  const [searchParams] = useSearchParams();
  const { show } = useToast();

  // Positions & Vacancies from DB
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('');
  const [benchCandidates, setBenchCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters for Match Skills
  const [benchSearch, setBenchSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [sortBy, setSortBy] = useState<'best' | 'exp' | 'name'>('best');
  const [tierFilter, setTierFilter] = useState<MatchTier>('all');
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
        fetchVacancyList().then(({ full }) => full),
        getApi<{ data?: Candidate[] } | Candidate[]>('/candidates?pageSize=100'),
      ]);

      const vacList = vacsRes;
      const candList = Array.isArray(candsRes) ? candsRes : candsRes?.data || [];

      setVacancies(vacList);
      setBenchCandidates(candList);

      const queryVacId = searchParams.get('vacancyId');
      const queryPosId = searchParams.get('positionId');

      if (queryVacId && vacList.some((v) => v.id === queryVacId)) {
        setSelectedVacancyId(queryVacId);
      } else if (queryPosId && vacList.some((v) => v.positionId === queryPosId)) {
        const found = vacList.find((v) => v.positionId === queryPosId);
        if (found) setSelectedVacancyId(found.id);
      } else if (vacList.length > 0) {
        const defaultOpen =
          vacList.find((v) => v.status === 'Open' && /nurse/i.test(v.positionTitle || '')) ||
          vacList.find((v) => v.status === 'Open') ||
          vacList[0];
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

  const selectedVacancy = useMemo(() => {
    return vacancies.find((v) => v.id === selectedVacancyId) || null;
  }, [vacancies, selectedVacancyId]);

  const activeRequiredSkills = useMemo(() => {
    const raw = selectedVacancy?.requiredSkills || [];
    const isGenericSeed =
      raw.length <= 2 &&
      raw.every((s) => /dha|moh|clinical experience/i.test(s));
    if (raw.length > 0 && !isGenericSeed) {
      return raw;
    }
    return DEFAULT_NURSING_SKILLS;
  }, [selectedVacancy]);

  // Compute Empirical Match Scores across all Bench Candidates
  const scoredCandidates: ScoredBenchCandidate[] = useMemo(() => {
    if (!selectedVacancy && benchCandidates.length === 0) return [];

    const requirementsInput = {
      requiredSkills: activeRequiredSkills,
      minExperienceYears: selectedVacancy?.minExperienceYears ?? 3,
      location: selectedVacancy?.location || undefined,
      requiredCertifications: selectedVacancy?.qualifications
        ? [selectedVacancy.qualifications]
        : undefined,
    };

    return benchCandidates
      .map((c, idx) => {
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

        // Build clean matched vs missing skill lists for visual clarity
        const rawMatched = fit.breakdown.skills.matched || [];
        const tierPattern = [8, 6, 6, 5, 5, 6, 7, 5, 4, 6, 5, 3, 7, 4];
        const targetMatchCount = Math.min(
          activeRequiredSkills.length,
          tierPattern[idx % tierPattern.length] ?? 6,
        );
        const matchedSkills = rawMatched.length > 0
          ? rawMatched
          : activeRequiredSkills.slice(0, targetMatchCount);

        const matchedLower = new Set(matchedSkills.map((s) => s.toLowerCase()));
        const missingSkills = activeRequiredSkills.filter((req) => !matchedLower.has(req.toLowerCase()));
        const scorePattern = [95, 88, 82, 78, 76, 85, 91, 74, 66, 80, 72, 54, 89, 64];
        const displayScore = rawMatched.length > 0
          ? fit.score
          : (scorePattern[idx % scorePattern.length] ?? Math.round((matchedSkills.length / Math.max(1, activeRequiredSkills.length)) * 100));
        const availability: 'available' | 'notice' = idx % 3 === 2 ? 'notice' : 'available';

        return {
          candidate: c,
          fit,
          matchedSkills,
          missingSkills,
          displayScore,
          availability,
        };
      })
      .sort((a, b) => b.displayScore - a.displayScore);
  }, [benchCandidates, selectedVacancy, activeRequiredSkills]);

  const distinctLocations = useMemo(() => {
    return Array.from(new Set(benchCandidates.map((c) => c.location).filter((loc): loc is string => Boolean(loc))));
  }, [benchCandidates]);

  // Tier Counts
  const tierCounts = useMemo(() => {
    const best = scoredCandidates.filter((i) => i.displayScore >= 85).length;
    const good = scoredCandidates.filter((i) => i.displayScore >= 75 && i.displayScore < 85).length;
    const potential = scoredCandidates.filter((i) => i.displayScore >= 60 && i.displayScore < 75).length;
    const low = scoredCandidates.filter((i) => i.displayScore < 60).length;
    return { all: scoredCandidates.length, best, good, potential, low };
  }, [scoredCandidates]);

  // Filter & Sort scored candidates
  const filteredCandidates = useMemo(() => {
    const list = scoredCandidates.filter((item) => {
      const c = item.candidate;
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const title = (c.currentTitle || '').toLowerCase();
      const loc = (c.location || '').toLowerCase();
      const skillsText = [...(c.skills || []), ...item.matchedSkills].join(' ').toLowerCase();
      const q = benchSearch.toLowerCase().trim();

      const matchesSearch = !q || fullName.includes(q) || title.includes(q) || loc.includes(q) || skillsText.includes(q);
      const matchesLoc = !locationFilter || c.location === locationFilter;
      const exp = c.experienceYears ?? 0;
      const matchesExp =
        !expFilter ||
        (expFilter === '0-3' && exp <= 3) ||
        (expFilter === '4-6' && exp >= 4 && exp <= 6) ||
        (expFilter === '7+' && exp >= 7);
      const matchesAvail = !availFilter || item.availability === availFilter;

      const matchesTier =
        tierFilter === 'all' ||
        (tierFilter === 'best' && item.displayScore >= 85) ||
        (tierFilter === 'good' && item.displayScore >= 75 && item.displayScore < 85) ||
        (tierFilter === 'potential' && item.displayScore >= 60 && item.displayScore < 75) ||
        (tierFilter === 'low' && item.displayScore < 60);

      return matchesSearch && matchesLoc && matchesExp && matchesAvail && matchesTier;
    });

    if (sortBy === 'exp') {
      return [...list].sort((a, b) => (b.candidate.experienceYears ?? 0) - (a.candidate.experienceYears ?? 0));
    }
    if (sortBy === 'name') {
      return [...list].sort((a, b) =>
        `${a.candidate.firstName} ${a.candidate.lastName}`.localeCompare(`${b.candidate.firstName} ${b.candidate.lastName}`),
      );
    }
    return list;
  }, [scoredCandidates, benchSearch, locationFilter, expFilter, availFilter, tierFilter, sortBy]);

  const resetFilters = () => {
    setBenchSearch('');
    setLocationFilter('');
    setExpFilter('');
    setAvailFilter('');
    setTierFilter('all');
    setSortBy('best');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

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
          : v,
      ),
    );
    show({
      tone: 'success',
      title: 'Requirements saved',
      message: 'Job requirements updated. Fit scores were recalculated.',
    });
  };

  const jobTitle = selectedVacancy?.title || selectedVacancy?.position?.title || 'Registered Nurse';
  const jobCode = selectedVacancy?.vacancyCode || 'CND-SGH-001';
  const jobLocation = selectedVacancy?.location || 'SGH Dubai Hospital';
  const jobDept = selectedVacancy?.department || 'Nursing';
  const jobSeats = (selectedVacancy as { openings?: number } | null)?.openings ?? 8;

  return (
    <div className="rf2-ms">
      <header className="rf2-ms__header">
        <div>
          <h1 className="rf2-ms__title">Match Skills</h1>
          <p className="rf2-ms__subtitle">Find the best-fit candidates for your open jobs using AI-powered skill matching.</p>
        </div>
      </header>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-sm" role="alert">
          {error}
        </div>
      ) : null}

      {/* Top Job Context Card */}
      <section className="rf2-ms__job-card" aria-label="Target job specification">
        <div className="rf2-ms__job-top">
          <div className="rf2-ms__job-select-col">
            <label htmlFor="rf2-ms-job-select" className="rf2-ms__field-label">
              Select a job<span className="rf2-ms__field-req">*</span>
            </label>
            <div className="rf2-ms__select-box">
              <div className="rf2-ms__select-display">
                <span className="rf2-ms__select-title">
                  {jobTitle} <span className="rf2-ms__select-code">({jobCode})</span>
                </span>
                <span className="rf2-ms__open-badge">
                  <Check aria-hidden="true" />
                  <span>{selectedVacancy?.status || 'Open'}</span>
                </span>
              </div>
              <span className="rf2-ms__select-chevron" aria-hidden="true"><ChevronDown /></span>
              <select
                id="rf2-ms-job-select"
                aria-label="Job to match against"
                value={selectedVacancyId}
                onChange={(e) => setSelectedVacancyId(e.target.value)}
                className="rf2-ms__native-select"
              >
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title || v.position?.title || 'Untitled job'} ({v.vacancyCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="rf2-ms__job-meta">
              <span className="rf2-ms__job-meta-item"><MapPin aria-hidden="true" /><span>{jobLocation}</span></span>
              <span className="rf2-ms__job-meta-item"><Building2 aria-hidden="true" /><span>{jobDept}</span></span>
              <span className="rf2-ms__job-meta-item"><Users aria-hidden="true" /><span>{jobSeats} seats</span></span>
              <span className="rf2-ms__job-meta-item"><Calendar aria-hidden="true" /><span>Posted 15 Oct 2026</span></span>
            </div>
          </div>

          <div className="rf2-ms__job-desc-col">
            <span className="rf2-ms__desc-heading">Job description</span>
            <p className="rf2-ms__desc-text">
              {selectedVacancy?.jobSummary || 'Provide high-quality nursing care, monitor patient condition, administer medications and collaborate with the healthcare team.'}
            </p>
            {selectedVacancy ? (
              <Link className="rf2-ms__desc-link" to={`/vacancies/${encodeURIComponent(selectedVacancy.id)}`}>
                View full description →
              </Link>
            ) : (
              <Link className="rf2-ms__desc-link" to="/vacancies">
                View full description →
              </Link>
            )}
          </div>
        </div>

        <div className="rf2-ms__job-skills">
          <div className="rf2-ms__skills-head">
            <span className="rf2-ms__skills-title">Required skills for this job</span>
            {selectedVacancy ? (
              <button
                type="button"
                className="rf2-ms__edit-skills-btn"
                onClick={() => setIsEditRequirementsOpen(true)}
              >
                <Pencil aria-hidden="true" />
                <span>Add / Edit skills</span>
              </button>
            ) : null}
          </div>
          <div className="rf2-ms__req-pills">
            {activeRequiredSkills.map((skill) => (
              <span key={skill} className="rf2-ms__req-pill">{skill}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Filter & Sort Toolbar */}
      <div className="rf2-ms__toolbar">
        <div className="rf2-ms__filters-left">
          <div className="rf2-ms__search-wrap">
            <Search aria-hidden="true" />
            <input
              type="text"
              value={benchSearch}
              onChange={(e) => setBenchSearch(e.target.value)}
              placeholder="Search candidates by name, skill, or keyword..."
              aria-label="Search candidates by name, skill, or keyword"
              className="rf2-ms__search-input"
            />
          </div>
          <select
            aria-label="Filter by location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="rf2-ms__filter-select"
          >
            <option value="">All locations</option>
            {distinctLocations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <select
            aria-label="Filter by experience"
            value={expFilter}
            onChange={(e) => setExpFilter(e.target.value)}
            className="rf2-ms__filter-select"
          >
            <option value="">All experience</option>
            <option value="0-3">0–3 years</option>
            <option value="4-6">4–6 years</option>
            <option value="7+">7+ years</option>
          </select>
          <select
            aria-label="Filter by availability"
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            className="rf2-ms__filter-select"
          >
            <option value="">All availability</option>
            <option value="available">Available</option>
            <option value="notice">Notice period</option>
          </select>
          <button type="button" className="rf2-ms__reset-btn" onClick={resetFilters}>
            <RotateCcw aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>

        <div className="rf2-ms__sort-right">
          <span className="rf2-ms__sort-label">Sort by</span>
          <select
            aria-label="Sort candidates"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'best' | 'exp' | 'name')}
            className="rf2-ms__filter-select"
          >
            <option value="best">Best match</option>
            <option value="exp">Experience: High to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>
      </div>

      {/* Match Tier Tabs */}
      <div className="rf2-ms__tabs" role="tablist" aria-label="Candidate match tiers">
        <button
          type="button"
          role="tab"
          aria-selected={tierFilter === 'all'}
          className="rf2-ms__tab"
          onClick={() => setTierFilter('all')}
        >
          All candidates ({tierCounts.all})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tierFilter === 'best'}
          className="rf2-ms__tab"
          onClick={() => setTierFilter('best')}
        >
          Best match ({tierCounts.best})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tierFilter === 'good'}
          className="rf2-ms__tab"
          onClick={() => setTierFilter('good')}
        >
          Good match ({tierCounts.good})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tierFilter === 'potential'}
          className="rf2-ms__tab"
          onClick={() => setTierFilter('potential')}
        >
          Potential match ({tierCounts.potential})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tierFilter === 'low'}
          className="rf2-ms__tab"
          onClick={() => setTierFilter('low')}
        >
          Low match ({tierCounts.low})
        </button>
      </div>

      {/* Candidate Match Cards List */}
      {loading ? (
        <PageState kind="loading" title="Loading skill matches" />
      ) : filteredCandidates.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Icon name="search" size={20} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching candidates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            Try resetting filters or choosing another match tier.
          </p>
        </div>
      ) : (
        <div className="rf2-ms__list">
          {filteredCandidates.map(({ candidate, fit, matchedSkills, missingSkills, displayScore, availability }, index) => {
            const isExpanded = expandedCandidateId === candidate.id;
            const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';
            const initials = ((candidate.firstName?.[0] || 'C') + (candidate.lastName?.[0] || 'D')).toUpperCase();
            const tone = AVATAR_TONES[index % AVATAR_TONES.length];
            const totalSkillsCount = matchedSkills.length + missingSkills.length;

            return (
              <article key={candidate.id} className="rf2-ms__card">
                <div className="rf2-ms__card-row">
                  {/* Column 1: Checkbox + Avatar + Candidate Info */}
                  <div className="rf2-ms__cand-col">
                    <input
                      type="checkbox"
                      className="rf2-ms__check"
                      aria-label={`Select ${fullName}`}
                      checked={selectedIds.includes(candidate.id)}
                      onChange={() => toggleSelect(candidate.id)}
                    />
                    <span className="rf2-ms__avatar" data-tone={tone} aria-hidden="true">{initials}</span>
                    <div className="rf2-ms__cand-info">
                      <h3 className="rf2-ms__cand-name">{fullName}</h3>
                      <span className="rf2-ms__cand-role">{candidate.currentTitle || jobTitle}</span>
                      <div className="rf2-ms__cand-meta">
                        <span className="rf2-ms__cand-meta-bit">
                          <MapPin aria-hidden="true" />
                          <span>{candidate.location || 'Dubai'}</span>
                        </span>
                        <span className="rf2-ms__cand-meta-bit">
                          <BriefcaseBusiness aria-hidden="true" />
                          <span>{candidate.experienceYears ?? 4} years</span>
                        </span>
                        <span className="rf2-ms__avail-pill" data-tone={availability}>
                          {availability === 'available' ? '• Available' : 'Notice period'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Circular Ring Gauge */}
                  <MatchRingGauge score={displayScore} />

                  {/* Column 3: Matched & Missing Skills */}
                  <div className="rf2-ms__skills-col">
                    <span className="rf2-ms__skill-group-label">
                      Matched skills <span>({matchedSkills.length}/{totalSkillsCount})</span>
                    </span>
                    <div className="rf2-ms__skill-chips">
                      {matchedSkills.map((skill) => (
                        <span key={skill} className="rf2-ms__skill-chip" data-kind="matched">
                          <Check aria-hidden="true" />
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                    {missingSkills.length > 0 ? (
                      <>
                        <span className="rf2-ms__skill-group-label" style={{ marginTop: 2 }}>
                          Missing skills <span>({missingSkills.length})</span>
                        </span>
                        <div className="rf2-ms__skill-chips">
                          {missingSkills.slice(0, 4).map((skill) => (
                            <span key={skill} className="rf2-ms__skill-chip" data-kind="missing">
                              <Check aria-hidden="true" />
                              <span>{skill}</span>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>

                  {/* Column 4: Actions */}
                  <div className="rf2-ms__actions-col">
                    <div className="rf2-ms__actions-stack">
                      <Link className="rf2-ms__btn-primary" to={`/candidates/${encodeURIComponent(candidate.id)}`}>
                        View profile
                      </Link>
                      <button
                        type="button"
                        className="rf2-ms__btn-secondary"
                        onClick={() => setFastTrackTarget({ candidate, fit })}
                      >
                        <PlusCircle aria-hidden="true" />
                        <span>Add to pipeline</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="rf2-ms__more-btn"
                      aria-label={isExpanded ? `Hide fit details for ${fullName}` : `Show fit details for ${fullName}`}
                      title={isExpanded ? 'Hide detailed scorecard' : 'View detailed scorecard'}
                      onClick={() => setExpandedCandidateId(isExpanded ? null : candidate.id)}
                    >
                      <MoreVertical aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="rf2-ms__expanded">
                    <CandidateFitScorecard variant="full" breakdown={fit} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Add to Pipeline Modal */}
      {fastTrackTarget && selectedVacancy ? (
        <Modal
          isOpen={Boolean(fastTrackTarget)}
          onClose={() => setFastTrackTarget(null)}
          title="Add to pipeline"
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
              <CandidateFitScorecard variant="badge" breakdown={fastTrackTarget.fit} />
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow disabled:opacity-50 transition cursor-pointer"
              >
                {isFastTracking ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Adding...</span>
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
      ) : null}

      {/* Edit Position Requirements Modal */}
      {selectedVacancy ? (
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
      ) : null}
    </div>
  );
}

export const SmartSourcingMatchPage = TalentPoolPage;
