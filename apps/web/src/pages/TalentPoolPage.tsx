import { useEffect, useMemo, useRef, useState } from 'react';
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
  availability: 'available' | 'notice' | 'unspecified';
  evidenceSnippets: Array<{ skill: string; snippets: string[] }>;
  alreadyOnJob: boolean;
  applicationId: string | null;
  stage: string | null;
  /** null until a server suggestion names this person. */
  addable: boolean | null;
  /** Set when the server match could not be loaded, so local scores are not shown. */
  scoreState?: 'unavailable';
}

interface ServerMatchedSkill {
  name: string;
  hasEvidence: boolean;
  snippets: string[];
}

interface ServerCandidateMatch {
  matchedSkills: ServerMatchedSkill[];
  missingSkills: string[];
  alreadyOnJob: boolean;
  applicationId: string | null;
  stage: string | null;
  addable: boolean | null;
}

interface ServerJobMatch {
  vacancyId: string;
  requiredCount: number;
  unmappedRequiredSkills: string[];
  byCandidateId: Record<string, ServerCandidateMatch>;
}

/** Job row on Match Skills. Redacted jobs stay read-only and are never filled in. */
interface MatchSkillsVacancy {
  id: string;
  title?: string | null;
  position?: { id?: string; title?: string; code?: string } | null;
  positionId?: string;
  vacancyCode?: string;
  status?: string;
  department?: string | null;
  location?: string | null;
  openings?: number | null;
  requiredSkills?: string[] | null;
  minExperienceYears?: number | null;
  qualifications?: string | null;
  jobSummary?: string | null;
  openedAt?: string | null;
  redacted?: boolean;
  siteName?: string | null;
  targetSeats?: number | null;
}

type MatchTier = 'all' | 'best' | 'good' | 'potential' | 'low';
type RingMode = 'score' | 'no-evidence' | 'needs-requirements' | 'no-job' | 'unavailable';

const AVATAR_TONES = ['blue', 'green', 'rose', 'amber'] as const;

function classifyAvailability(candidate: Candidate): 'available' | 'notice' | 'unspecified' {
  const metadata = candidate.metadata as Record<string, unknown> | undefined;
  const raw = candidate.availability ?? metadata?.availability;
  const rawAvail = typeof raw === 'string' ? raw : '';
  if (/immediate|available/i.test(rawAvail)) return 'available';
  if (/notice|days|weeks|month/i.test(rawAvail)) return 'notice';
  return 'unspecified';
}

const EMPTY_SERVER_FIELDS = {
  evidenceSnippets: [] as Array<{ skill: string; snippets: string[] }>,
  alreadyOnJob: false,
  applicationId: null as string | null,
  stage: null as string | null,
  addable: null as boolean | null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStatusCode(err: unknown): number | null {
  if (!isRecord(err)) return null;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (typeof err.status === 'number') return err.status;
  return null;
}

const ACCEPTING_APPLICATION_STATUSES = new Set(['Open', 'Partially Filled']);
const MATCH_TIERS: readonly MatchTier[] = ['all', 'best', 'good', 'potential', 'low'];

function parseTier(value: string | null): MatchTier {
  return MATCH_TIERS.includes(value as MatchTier) ? (value as MatchTier) : 'all';
}

function parseSort(value: string | null): 'best' | 'exp' | 'name' {
  return value === 'exp' || value === 'name' ? value : 'best';
}

function sameQuery(left: URLSearchParams, right: URLSearchParams): boolean {
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    if (left.get(key) !== right.get(key)) return false;
  }
  return true;
}

function isApplicationExists(err: unknown): boolean {
  if (!isRecord(err)) return false;
  if (err.code === 'APPLICATION_EXISTS') return true;
  return isRecord(err.details) && err.details.code === 'APPLICATION_EXISTS';
}

interface LocalPipelineMembership {
  applicationId: string | null;
  stage: string;
}

function applyLocalPipeline(
  row: ScoredBenchCandidate,
  membership: Record<string, LocalPipelineMembership>,
  vacancyId: string,
): ScoredBenchCandidate {
  const local = membership[`${vacancyId}:${row.candidate.id}`];
  if (!local) return row;
  return {
    ...row,
    alreadyOnJob: true,
    applicationId: local.applicationId ?? row.applicationId,
    stage: local.stage,
    addable: false,
  };
}

function skillNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== 'string') return [];
    const name = item.name.trim();
    return name ? [name] : [];
  });
}

function matchedFromServer(value: unknown): ServerMatchedSkill[] {
  if (!Array.isArray(value)) return [];
  const skills: ServerMatchedSkill[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isRecord(item.skill) || typeof item.skill.name !== 'string') continue;
    const name = item.skill.name.trim();
    if (!name) continue;
    const snippets = Array.isArray(item.evidence)
      ? item.evidence.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.snippet !== 'string') return [];
          const snippet = entry.snippet.trim();
          return snippet ? [snippet] : [];
        })
      : [];
    skills.push({ name, hasEvidence: item.hasEvidence === true, snippets });
  }
  return skills;
}

/** Accept only a suggestions payload for the job that was requested. Candidate lists and other jobs are ignored. */
function parseSuggestions(raw: unknown, vacancyId: string): ServerJobMatch | null {
  if (!isRecord(raw) || raw.vacancyId !== vacancyId || !Array.isArray(raw.suggestions) || !Array.isArray(raw.requiredSkills)) return null;
  const unmappedRequiredSkills = Array.isArray(raw.unmappedRequiredSkills)
    ? raw.unmappedRequiredSkills.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : []))
    : [];
  const byCandidateId: Record<string, ServerCandidateMatch> = {};
  for (const item of raw.suggestions) {
    if (!isRecord(item) || !isRecord(item.candidate) || typeof item.candidate.id !== 'string') continue;
    const alreadyOnJob = item.alreadyOnJob === true;
    byCandidateId[item.candidate.id] = {
      matchedSkills: matchedFromServer(item.matchedSkills),
      missingSkills: skillNames(item.missingSkills),
      alreadyOnJob,
      applicationId: typeof item.applicationId === 'string' && item.applicationId.trim() ? item.applicationId : null,
      stage: typeof item.stage === 'string' && item.stage.trim() ? item.stage : null,
      addable: typeof item.addable === 'boolean' ? item.addable : (alreadyOnJob ? false : null),
    };
  }
  return { vacancyId, requiredCount: raw.requiredSkills.length, unmappedRequiredSkills, byCandidateId };
}

function applyServerMatch(
  row: ScoredBenchCandidate,
  server: ServerJobMatch | null,
  vacancyId: string,
  activeRequiredSkills: string[],
): ScoredBenchCandidate {
  if (!server || server.vacancyId !== vacancyId) return row;
  const totalRequiredCount = server.requiredCount + server.unmappedRequiredSkills.length;
  const match = server.byCandidateId[row.candidate.id];
  if (!match) {
    return {
      ...row,
      matchedSkills: [],
      missingSkills: activeRequiredSkills,
      displayScore: 0,
      evidenceSnippets: [],
    };
  }
  const evidenced = match.matchedSkills.filter((skill) => skill.hasEvidence);
  const matchedSkills = evidenced.map((skill) => skill.name);
  const missingSkills = [
    ...match.matchedSkills.filter((skill) => !skill.hasEvidence).map((skill) => skill.name),
    ...match.missingSkills,
    ...server.unmappedRequiredSkills,
  ];
  return {
    ...row,
    matchedSkills,
    missingSkills,
    displayScore: totalRequiredCount === 0 ? 0 : Math.round((evidenced.length / totalRequiredCount) * 100),
    evidenceSnippets: evidenced.map((skill) => ({ skill: skill.name, snippets: skill.snippets })),
    alreadyOnJob: match.alreadyOnJob,
    applicationId: match.applicationId,
    stage: match.stage,
    addable: match.addable,
  };
}

function availabilityLabel(availability: 'available' | 'notice' | 'unspecified'): string {
  if (availability === 'available') return '• Available';
  if (availability === 'notice') return 'Notice period';
  return 'Availability not specified';
}

function getGaugeMeta(score: number): { label: string; tone: 'excellent' | 'strong' | 'good' | 'potential' | 'low'; color: string } {
  if (score >= 90) return { label: 'Excellent match', tone: 'excellent', color: '#16a34a' };
  if (score >= 85) return { label: 'Strong match', tone: 'strong', color: '#16a34a' };
  if (score >= 75) return { label: 'Good match', tone: 'good', color: '#2563eb' };
  if (score >= 60) return { label: 'Potential match', tone: 'potential', color: '#d97706' };
  return { label: 'Low match', tone: 'low', color: '#dc2626' };
}

function MatchRingGauge({ score, mode }: { score: number; mode: RingMode }) {
  const hideScore = mode === 'needs-requirements' || mode === 'no-job' || mode === 'unavailable';
  const meta = mode === 'unavailable'
    ? { label: 'Match unavailable', tone: 'low' as const, color: '#94a3b8' }
    : mode === 'needs-requirements' || mode === 'no-job'
      ? {
          label: mode === 'no-job' ? 'No requirements' : 'Requirements needed',
          tone: 'low' as const,
          color: '#94a3b8',
        }
      : mode === 'no-evidence'
        ? { label: 'No evidence found', tone: 'low' as const, color: '#dc2626' }
        : getGaugeMeta(score);
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const clamped = hideScore ? 0 : Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (clamped / 100) * circumference;
  const valueText = hideScore ? '—' : `${clamped}%`;

  return (
    <div className="rf2-ms__gauge" role="img" aria-label={`${valueText} ${meta.label}`}>
      <div className="rf2-ms__gauge-ring">
        <svg className="rf2-ms__gauge-svg" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={radius} stroke="rgba(148, 163, 184, 0.22)" strokeWidth="4.5" fill="none" />
          {hideScore ? null : (
            <circle
              cx="28"
              cy="28"
              r={radius}
              stroke={meta.color}
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>
        <span className="rf2-ms__gauge-pct">{valueText}</span>
      </div>
      <span className="rf2-ms__gauge-label" data-tone={meta.tone}>{meta.label}</span>
    </div>
  );
}

export function TalentPoolPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { show } = useToast();
  const suppressVacancyReload = useRef<string | null>(null);

  // Positions & Vacancies from DB
  const [vacancies, setVacancies] = useState<MatchSkillsVacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('');
  const [benchCandidates, setBenchCandidates] = useState<Candidate[]>([]);
  const [serverJobMatch, setServerJobMatch] = useState<ServerJobMatch | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsRetryTick, setSuggestionsRetryTick] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pipelineMembership, setPipelineMembership] = useState<Record<string, LocalPipelineMembership>>({});
  const loadGeneration = useRef(0);
  const suggestionGeneration = useRef(0);

  // Filters for Match Skills
  const [benchSearch, setBenchSearch] = useState(() => searchParams.get('q') ?? '');
  const [locationFilter, setLocationFilter] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [sortBy, setSortBy] = useState<'best' | 'exp' | 'name'>(() => parseSort(searchParams.get('sort')));
  const [tierFilter, setTierFilter] = useState<MatchTier>(() => parseTier(searchParams.get('tier')));
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Edit Position Requirements Modal
  const [isEditRequirementsOpen, setIsEditRequirementsOpen] = useState(false);

  // Fast-Track Modal state
  const [fastTrackTarget, setFastTrackTarget] = useState<{
    candidate: Candidate;
    fit: CriteriaBreakdown;
  } | null>(null);
  const [fastTrackNote, setFastTrackNote] = useState('');
  const [isFastTracking, setIsFastTracking] = useState(false);

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (vacancyQuery: string, positionQuery: string) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);

    try {
      const [vacsRes, candsRes] = await Promise.all([
        fetchVacancyList().then(({ full, redacted }) => {
          const fullIds = new Set(full.map((v) => v.id));
          const fullRows: MatchSkillsVacancy[] = full.map((v: Vacancy) => ({
            ...v,
            redacted: false,
          }));
          const extra: MatchSkillsVacancy[] = (redacted || [])
            .filter((r) => !fullIds.has(r.id))
            .map((r) => ({
              id: r.id,
              title: r.title || 'Restricted job',
              vacancyCode: 'Restricted',
              status: 'Restricted',
              department: '',
              location: r.site?.name || 'Restricted location',
              openings: r.seats?.target ?? null,
              requiredSkills: [],
              redacted: true,
              siteName: r.site?.name ?? null,
              targetSeats: r.seats?.target ?? null,
            }));
          return [...fullRows, ...extra];
        }),
        getApi<{ data?: Candidate[] } | Candidate[]>('/candidates?pageSize=100'),
      ]);

      if (generation !== loadGeneration.current) return;

      const vacList = vacsRes;
      const candList = Array.isArray(candsRes) ? candsRes : candsRes?.data || [];

      setVacancies(vacList);
      setBenchCandidates(candList);

      if (vacancyQuery && vacList.some((v) => v.id === vacancyQuery)) {
        setSelectedVacancyId(vacancyQuery);
      } else if (positionQuery && vacList.some((v) => v.positionId === positionQuery)) {
        const found = vacList.find((v) => v.positionId === positionQuery);
        if (found) setSelectedVacancyId(found.id);
      } else if (vacList.length > 0) {
        const defaultOpen =
          vacList.find((v) => !v.redacted && v.status === 'Open') ||
          vacList.find((v) => !v.redacted) ||
          vacList[0];
        setSelectedVacancyId(defaultOpen.id);
      }
    } catch (err: unknown) {
      if (generation !== loadGeneration.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load sourcing data.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  };

  const vacancyQuery = searchParams.get('vacancyId') ?? '';
  const positionQuery = searchParams.get('positionId') ?? '';

  useEffect(() => {
    if (suppressVacancyReload.current && suppressVacancyReload.current === vacancyQuery) {
      suppressVacancyReload.current = null;
      return;
    }
    void loadData(vacancyQuery, positionQuery);
  }, [vacancyQuery, positionQuery]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedVacancyId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedVacancyId) next.set('vacancyId', selectedVacancyId);
    if (benchSearch) next.set('q', benchSearch);
    else next.delete('q');
    if (tierFilter !== 'all') next.set('tier', tierFilter);
    else next.delete('tier');
    if (sortBy !== 'best') next.set('sort', sortBy);
    else next.delete('sort');
    if (sameQuery(next, searchParams)) return;
    if (selectedVacancyId && selectedVacancyId !== vacancyQuery) {
      suppressVacancyReload.current = selectedVacancyId;
    }
    setSearchParams(next, { replace: true });
  }, [selectedVacancyId, benchSearch, tierFilter, sortBy, searchParams, setSearchParams, vacancyQuery]);

  useEffect(() => {
    if (document.activeElement?.id === 'rf2-ms-candidate-search') return;
    const nextQuery = searchParams.get('q') ?? '';
    const nextTier = parseTier(searchParams.get('tier'));
    const nextSort = parseSort(searchParams.get('sort'));
    setBenchSearch((current) => (current === nextQuery ? current : nextQuery));
    setTierFilter((current) => (current === nextTier ? current : nextTier));
    setSortBy((current) => (current === nextSort ? current : nextSort));
  }, [searchParams]);

  useEffect(() => {
    const vacancy = vacancies.find((item) => item.id === selectedVacancyId) ?? null;
    if (!selectedVacancyId || !vacancy || vacancy.redacted) {
      suggestionGeneration.current += 1;
      setServerJobMatch(null);
      setSuggestionsError(null);
      return;
    }
    const generation = ++suggestionGeneration.current;
    const vacancyId = selectedVacancyId;
    let active = true;
    setSuggestionsError(null);
    setServerJobMatch((current) => (current?.vacancyId === vacancyId ? current : null));
    void (async () => {
      try {
        const raw: unknown = await getApi<unknown>(`/vacancies/${encodeURIComponent(vacancyId)}/suggestions`);
        if (!active || generation !== suggestionGeneration.current) return;
        const parsed = parseSuggestions(raw, vacancyId);
        if (!parsed) return;
        setServerJobMatch(parsed);
        setSuggestionsError(null);
      } catch (err: unknown) {
        if (!active || generation !== suggestionGeneration.current) return;
        const status = readStatusCode(err);
        if (status === 403 || status === 404) {
          setServerJobMatch(null);
          setSuggestionsError(null);
          return;
        }
        setServerJobMatch(null);
        setSuggestionsError(err instanceof Error ? err.message : 'Could not load server skill matches for this job.');
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedVacancyId, vacancies, suggestionsRetryTick]);

  const selectedVacancy = useMemo(() => {
    return vacancies.find((v) => v.id === selectedVacancyId) || null;
  }, [vacancies, selectedVacancyId]);

  const activeRequiredSkills = useMemo(() => {
    return (selectedVacancy?.requiredSkills || []).map((skill) => skill.trim()).filter(Boolean);
  }, [selectedVacancy]);

  const scoredCandidates: ScoredBenchCandidate[] = useMemo(() => {
    if (benchCandidates.length === 0) return [];

    const skillMatchReady = Boolean(selectedVacancy) && !selectedVacancy?.redacted && activeRequiredSkills.length > 0;
    const requirementsInput = skillMatchReady
      ? {
          requiredSkills: activeRequiredSkills,
          minExperienceYears: selectedVacancy?.minExperienceYears ?? undefined,
          location: selectedVacancy?.location || undefined,
          requiredCertifications: selectedVacancy?.qualifications
            ? [selectedVacancy.qualifications]
            : undefined,
        }
      : { requiredSkills: [] as string[] };

    return benchCandidates
      .map((c) => {
        const metadata = c.metadata as Record<string, unknown> | undefined;
        const candidateInput = {
          skills: c.skills || [],
          experienceYears: c.experienceYears ?? undefined,
          location: c.location || undefined,
          certifications: c.certifications || [],
          currentTitle: c.currentTitle || undefined,
          summary: c.summary || metadata?.summary as string | undefined,
          rawText: (c as { rawText?: string }).rawText || c.summary || undefined,
          workHistory: metadata?.workHistory as Parameters<typeof calculateCandidateFitScore>[0]['workHistory'],
          educationHistory: metadata?.educationHistory as Parameters<typeof calculateCandidateFitScore>[0]['educationHistory'],
          projectHistory: metadata?.projectHistory as Parameters<typeof calculateCandidateFitScore>[0]['projectHistory'],
          evidenceChunks: metadata?.evidenceChunks as Parameters<typeof calculateCandidateFitScore>[0]['evidenceChunks'],
          responsibilities: metadata?.responsibilities as Parameters<typeof calculateCandidateFitScore>[0]['responsibilities'],
        };
        const fit = calculateCandidateFitScore(candidateInput, requirementsInput);
        const availability = classifyAvailability(c);

        if (!skillMatchReady) {
          return {
            candidate: c,
            fit,
            matchedSkills: [],
            missingSkills: activeRequiredSkills,
            displayScore: 0,
            availability,
            ...EMPTY_SERVER_FIELDS,
          };
        }

        const matchedSkills = fit.breakdown.skills.matched || [];
        const missingSkills = fit.breakdown.skills.missing
          ?? activeRequiredSkills.filter((req) => !matchedSkills.some((skill) => skill.toLowerCase() === req.toLowerCase()));
        const displayScore = matchedSkills.length === 0 ? 0 : fit.breakdown.skills.percentage;

        return {
          candidate: c,
          fit,
          matchedSkills,
          missingSkills,
          displayScore,
          availability,
          ...EMPTY_SERVER_FIELDS,
        };
      })
      .map((row) => (
        suggestionsError
          ? {
              ...row,
              matchedSkills: [],
              missingSkills: activeRequiredSkills,
              displayScore: 0,
              evidenceSnippets: [],
              scoreState: 'unavailable' as const,
            }
          : applyServerMatch(row, serverJobMatch, selectedVacancyId, activeRequiredSkills)
      ))
      .map((row) => applyLocalPipeline(row, pipelineMembership, selectedVacancyId))
      .sort((a, b) => b.displayScore - a.displayScore);
  }, [benchCandidates, selectedVacancy, activeRequiredSkills, serverJobMatch, selectedVacancyId, pipelineMembership, suggestionsError]);

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
  const rememberInPipeline = (candidateId: string, vacancyId: string, applicationId: string | null) => {
    setPipelineMembership((current) => ({
      ...current,
      [`${vacancyId}:${candidateId}`]: { applicationId, stage: 'Applied' },
    }));
  };

  const handleFastTrackSubmit = async () => {
    if (!fastTrackTarget || !selectedVacancy) return;
    const candidateId = fastTrackTarget.candidate.id;
    const vacancyId = selectedVacancy.id;
    const note = fastTrackNote.trim();
    const personName = `${fastTrackTarget.candidate.firstName} ${fastTrackTarget.candidate.lastName}`.trim();
    setIsFastTracking(true);
    try {
      const created = await postApi<{ id?: string }>('/applications', { candidateId, vacancyId });
      const applicationId = created?.id ?? null;
      if (note && applicationId) {
        await postApi(`/applications/${encodeURIComponent(applicationId)}/notes`, { content: note }).catch(() => {});
      }
      rememberInPipeline(candidateId, vacancyId, applicationId);
      show({
        tone: 'success',
        title: 'Added to job',
        message: `${personName} is now on ${selectedVacancy.title || 'this job'} at Applied.`,
      });
      setFastTrackTarget(null);
      setFastTrackNote('');
    } catch (err: unknown) {
      if (isApplicationExists(err)) {
        rememberInPipeline(candidateId, vacancyId, null);
        show({
          tone: 'info',
          title: 'Already in pipeline',
          message: `${personName} is already on ${selectedVacancy.title || 'this job'}.`,
        });
        setFastTrackTarget(null);
        setFastTrackNote('');
        return;
      }
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

  const unmappedRequiredSkills = serverJobMatch?.vacancyId === selectedVacancyId ? serverJobMatch.unmappedRequiredSkills : [];
  const jobIsRedacted = Boolean(selectedVacancy?.redacted);
  const skillMatchReady = Boolean(selectedVacancy) && !jobIsRedacted && activeRequiredSkills.length > 0;
  const jobTitle = selectedVacancy?.title || selectedVacancy?.position?.title || (jobIsRedacted ? 'Restricted job' : 'No job selected');
  const jobCode = selectedVacancy?.vacancyCode || '—';
  const jobLocation = jobIsRedacted
    ? (selectedVacancy?.location || 'Restricted location')
    : (selectedVacancy?.location || 'Location not specified');
  const jobDept = jobIsRedacted
    ? 'Restricted access'
    : (selectedVacancy?.department || 'Department not specified');
  const jobSeats = selectedVacancy?.openings ?? null;
  const jobSummary = jobIsRedacted
    ? 'Restricted access'
    : (selectedVacancy?.jobSummary || 'No job description provided.');
  const openedAt = selectedVacancy?.openedAt ? new Date(selectedVacancy.openedAt) : null;
  const postedLabel = jobIsRedacted
    ? 'Restricted access'
    : openedAt && !Number.isNaN(openedAt.getTime())
      ? `Posted ${openedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'Posted date not specified';
  const seatsLabel = jobSeats != null ? `${jobSeats} seats` : 'Seats not specified';
  const pipelineBlocked = !selectedVacancy || jobIsRedacted || activeRequiredSkills.length === 0;
  const jobNotAccepting = Boolean(selectedVacancy) && !ACCEPTING_APPLICATION_STATUSES.has(selectedVacancy?.status ?? '');
  const compareCountOk = selectedIds.length >= 2 && selectedIds.length <= 4;
  const compareReady = compareCountOk && Boolean(selectedVacancy) && !jobIsRedacted;
  const compareHref = selectedVacancy
    ? `/candidates/compare?vacancyId=${encodeURIComponent(selectedVacancy.id)}&ids=${selectedIds.map((id) => encodeURIComponent(id)).join(',')}`
    : '/candidates/compare';

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

      {suggestionsError ? (
        <div className="rf2-ms__match-alert" role="alert">
          <p>{suggestionsError}</p>
          <button type="button" className="rf2-ms__retry-btn" onClick={() => setSuggestionsRetryTick((tick) => tick + 1)}>
            Retry matching
          </button>
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
                  <span>{selectedVacancy?.status || 'No job selected'}</span>
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
                    {v.title || v.position?.title || (v.redacted ? 'Restricted job' : 'Untitled job')} ({v.vacancyCode || '—'})
                  </option>
                ))}
              </select>
            </div>
            <div className="rf2-ms__job-meta">
              <span className="rf2-ms__job-meta-item"><MapPin aria-hidden="true" /><span>{jobLocation}</span></span>
              <span className="rf2-ms__job-meta-item"><Building2 aria-hidden="true" /><span>{jobDept}</span></span>
              <span className="rf2-ms__job-meta-item"><Users aria-hidden="true" /><span>{seatsLabel}</span></span>
              <span className="rf2-ms__job-meta-item"><Calendar aria-hidden="true" /><span>{postedLabel}</span></span>
            </div>
          </div>

          <div className="rf2-ms__job-desc-col">
            <span className="rf2-ms__desc-heading">Job description</span>
            <p className="rf2-ms__desc-text">
              {jobSummary}
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
                disabled={jobIsRedacted}
              >
                <Pencil aria-hidden="true" />
                <span>Add / Edit skills</span>
              </button>
            ) : null}
          </div>
          {activeRequiredSkills.length === 0 ? (
            <p>
              No required skills defined for this job yet. Finish job requirements to calculate skill matches.
            </p>
          ) : (
            <div className="rf2-ms__req-pills">
              {activeRequiredSkills.map((skill) => (
                <span key={skill} className="rf2-ms__req-pill">{skill}</span>
              ))}
            </div>
          )}
          {unmappedRequiredSkills.length > 0 ? (
            <p>
              Not in the active skill library: {unmappedRequiredSkills.join(', ')}. These required skills cannot be matched until they are added to the library.
            </p>
          ) : null}
        </div>
      </section>

      {/* Filter & Sort Toolbar */}
      <div className="rf2-ms__toolbar">
        <div className="rf2-ms__filters-left">
          <div className="rf2-ms__search-wrap">
            <Search aria-hidden="true" />
            <input
              id="rf2-ms-candidate-search"
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

      {selectedIds.length > 0 ? (
        <div className="rf2-ms__toolbar" role="region" aria-label="Selected candidates">
          <div className="rf2-ms__filters-left">
            <span className="rf2-ms__sort-label">{selectedIds.length} selected</span>
            {compareReady ? (
              <Link className="rf2-ms__btn-primary min-h-11" style={{ minHeight: 44 }} to={compareHref}>
                Compare selected ({selectedIds.length})
              </Link>
            ) : (
              <button
                type="button"
                className="rf2-ms__btn-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled
                aria-describedby={compareCountOk ? undefined : 'compare-selection-hint'}
                title={compareCountOk ? 'Choose an open job before comparing' : 'Select 2 to 4 candidates to compare'}
              >
                Compare selected ({selectedIds.length})
              </button>
            )}
            {compareCountOk ? null : (
              <span id="compare-selection-hint">Select 2 to 4 candidates to compare</span>
            )}
            <button type="button" className="rf2-ms__reset-btn min-h-11" style={{ minHeight: 44 }} onClick={() => setSelectedIds([])}>
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      {/* Candidate Match Cards List */}
      {loading ? (
        <PageState kind="loading" title="Loading skill matches" />
      ) : filteredCandidates.length === 0 ? (
        <div className="rf2-ms__empty" role="status">
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
          {filteredCandidates.map(({ candidate, fit, matchedSkills, missingSkills, displayScore, availability, evidenceSnippets, alreadyOnJob, applicationId, stage, addable, scoreState }, index) => {
            const isExpanded = expandedCandidateId === candidate.id;
            const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';
            const initials = ((candidate.firstName?.[0] || 'C') + (candidate.lastName?.[0] || 'D')).toUpperCase();
            const tone = AVATAR_TONES[index % AVATAR_TONES.length];
            const totalSkillsCount = matchedSkills.length + missingSkills.length;
            const skillChips = evidenceSnippets.length > 0
              ? evidenceSnippets
              : matchedSkills.map((skill) => ({ skill, snippets: [] as string[] }));
            const addDisabled = pipelineBlocked || addable === false || jobNotAccepting;

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
                      <span className="rf2-ms__cand-role">{candidate.currentTitle || 'Title not specified'}</span>
                      <div className="rf2-ms__cand-meta">
                        <span className="rf2-ms__cand-meta-bit">
                          <MapPin aria-hidden="true" />
                          <span>{candidate.location || 'Location not specified'}</span>
                        </span>
                        <span className="rf2-ms__cand-meta-bit">
                          <BriefcaseBusiness aria-hidden="true" />
                          <span>{candidate.experienceYears != null ? `${candidate.experienceYears} years` : 'Experience not specified'}</span>
                        </span>
                        <span className="rf2-ms__avail-pill" data-tone={availability}>
                          {availabilityLabel(availability)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Circular Ring Gauge */}
                  <MatchRingGauge
                    score={displayScore}
                    mode={scoreState === 'unavailable' ? 'unavailable' : !selectedVacancy ? 'no-job' : !skillMatchReady ? 'needs-requirements' : matchedSkills.length === 0 ? 'no-evidence' : 'score'}
                  />

                  {/* Column 3: Matched & Missing Skills */}
                  <div className="rf2-ms__skills-col" role="group" aria-label="Matched and missing skills">
                    {scoreState === 'unavailable' ? (
                      <p>Server skill match is unavailable.</p>
                    ) : (
                      <>
                    <span className="rf2-ms__skill-group-label">
                      Matched skills <span>({matchedSkills.length}{'/'}{totalSkillsCount})</span>
                    </span>
                    <div className="rf2-ms__skill-chips">
                      {skillChips.map((chip) => {
                        const evidence = chip.snippets[0];
                        return (
                          <span
                            key={chip.skill}
                            className="rf2-ms__skill-chip"
                            data-kind="matched"
                            title={evidence ? `Evidence: ${evidence}` : undefined}
                          >
                            <Check aria-hidden="true" />
                            <span>{chip.skill}</span>
                            {evidence ? (
                              <span className="rf2-ms__evidence-tip" role="tooltip">{evidence}</span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                    {missingSkills.length > 0 ? (
                      <>
                        <span className="rf2-ms__skill-group-label" style={{ marginTop: 2 }}>
                          Missing skills <span>({missingSkills.length})</span>
                        </span>
                        <div className="rf2-ms__skill-chips">
                          {missingSkills.slice(0, 4).map((skill) => (
                            <span key={skill} className="rf2-ms__skill-chip" data-kind="missing">
                              <span>{skill}</span>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                      </>
                    )}
                  </div>

                  {/* Column 4: Actions */}
                  <div className="rf2-ms__actions-col" role="group" aria-label="Candidate actions">
                    <div className="rf2-ms__actions-stack">
                      <Link className="rf2-ms__btn-primary" to={`/candidates/${encodeURIComponent(candidate.id)}`}>
                        View profile
                      </Link>
                      {alreadyOnJob && applicationId ? (
                        <Link className="rf2-ms__btn-secondary no-underline" to={`/applications/${encodeURIComponent(applicationId)}`}>
                          Open application ({stage || 'Applied'})
                        </Link>
                      ) : alreadyOnJob ? (
                        <button type="button" className="rf2-ms__btn-secondary disabled:cursor-not-allowed disabled:opacity-60" disabled>
                          Already in pipeline ({stage || 'Applied'})
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rf2-ms__btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => setFastTrackTarget({ candidate, fit })}
                          disabled={addDisabled}
                          title={jobNotAccepting ? 'Job is not accepting new applications' : undefined}
                        >
                          <PlusCircle aria-hidden="true" />
                          <span>Add to pipeline</span>
                        </button>
                      )}
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

            <p className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Entry stage: Applied
            </p>

            <div className="space-y-1.5">
              <label htmlFor="fast-track-note" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Note
              </label>
              <textarea
                id="fast-track-note"
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
      {selectedVacancy && !selectedVacancy.redacted ? (
        <EditPositionRequirementsModal
          isOpen={isEditRequirementsOpen}
          onClose={() => setIsEditRequirementsOpen(false)}
          vacancyId={selectedVacancy.id}
          positionTitle={selectedVacancy.title || selectedVacancy.position?.title || 'Position'}
          positionCode={selectedVacancy.vacancyCode}
          initialSkills={selectedVacancy.requiredSkills || []}
          initialMinExp={selectedVacancy.minExperienceYears ?? null}
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
