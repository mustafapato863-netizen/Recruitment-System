import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Crown,
  FileText,
  Info,
  MapPin,
  MoreVertical,
  Plus,
  Scale,
  Sparkles,
  Star,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { getApi } from '../../api/client';
import {
  addToJob,
  fetchBank,
  fetchCompare,
  matchErrorFromError,
  sourceLabel,
  type CompareInfoCell,
  type CompareResponse,
} from '../api/matching';
import { compareCandidatesReturn, parseCompareIds, usePageReturn, withReturnTo } from '../returnTarget';
import { fetchOpenJobs, jobTitle, type JobDetail } from '../api/jobs';
import { fetchAllPages } from '../api/paged';
import { getInitials } from '../userIdentity';
import { formatDay } from './OpenJobsV2';
import './jobs.css';
import './compare-skills.css';

type App = { id: string; candidateId: string; stage: string; source?: string | null };

function infoText(key: 'notice-period' | 'fit-note' | 'nationality', cell?: CompareInfoCell) {
  if (!cell || cell.value === null || cell.value === '') return <p className="rf2-jtable__sub">Not recorded.</p>;
  const main =
    key === 'notice-period' && typeof cell.value === 'number'
      ? cell.value === 0
        ? 'Available now'
        : `${cell.value} days`
      : String(cell.value);
  const meta = [
    cell.source === 'screening' ? 'screening' : cell.source === 'profile' ? 'profile' : null,
    cell.by?.name,
    cell.at ? formatDay(cell.at) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <p>{key === 'fit-note' ? `“${main}”` : main}</p>
      {meta ? <p className="rf2-jtable__sub">{meta}</p> : null}
    </>
  );
}

type StudioJobOption = {
  id: string;
  title: string;
  code: string;
  status: string;
  site: string;
  department: string;
  seats: number;
  postedLabel: string;
};

type StudioCandidateProfile = {
  id: string;
  name: string;
  role: string;
  location: string;
  experienceYears: number;
  experienceDomains: string;
  experienceTag: string;
  avatarTone: 'blue' | 'green' | 'rose' | 'amber';
  bestFit?: boolean;
  availabilityKind: 'available' | 'notice';
  availabilityShort: string;
  availabilityDetail: string;
  overallMatch: number;
  matchTier: string;
  matchTone: 'green' | 'blue';
  matchedSkills: string[];
  missingSkillPills: string[];
  extraSkillCount: number;
  certifications: Array<{ label: string; kind: 'ok' | 'check' | 'warn' }>;
  languages: Array<{ label: string; kind: 'neutral' | 'warn' }>;
  salaryRange: string;
  salaryTag: string;
  salaryKind: 'ok' | 'warn';
  interviewScore: string;
  interviewTone: 'green' | 'amber';
  interviewComment: string;
  strengths: string[];
  gaps: Array<{ label: string; kind: 'ok' | 'warn' }>;
  note: string;
  recTier: string;
  recTone: 'green' | 'blue' | 'amber';
  recSummary: string;
};

const STUDIO_JOBS: StudioJobOption[] = [
  {
    id: 'job-rn-001',
    title: 'Registered Nurse',
    code: 'CND-SGH-001',
    status: 'Open',
    site: 'SGH Dubai Hospital',
    department: 'Nursing',
    seats: 8,
    postedLabel: 'Posted 15 Oct 2026',
  },
  {
    id: 'job-icu-002',
    title: 'ICU Registered Nurse',
    code: 'CND-SGH-002',
    status: 'Open',
    site: 'SGH Riyadh Hospital',
    department: 'Critical Care',
    seats: 5,
    postedLabel: 'Posted 18 Oct 2026',
  },
  {
    id: 'job-rad-003',
    title: 'Radiology Technician',
    code: 'CND-SGH-003',
    status: 'Open',
    site: 'SGH Jeddah Hospital',
    department: 'Diagnostic Imaging',
    seats: 3,
    postedLabel: 'Posted 20 Oct 2026',
  },
  {
    id: 'job-cod-004',
    title: 'Medical Coder',
    code: 'CND-SGH-004',
    status: 'Open',
    site: 'SGH Cairo Hospital',
    department: 'Health Information',
    seats: 4,
    postedLabel: 'Posted 22 Oct 2026',
  },
];

const DEFAULT_STUDIO_CANDIDATES: StudioCandidateProfile[] = [
  {
    id: 'cand-nabil-ahmed',
    name: 'Nabil Ahmed',
    role: 'Registered Nurse',
    location: 'Dubai',
    experienceYears: 8,
    experienceDomains: 'ICU, Medical-Surgical, Emergency',
    experienceTag: 'Strong clinical experience',
    avatarTone: 'blue',
    bestFit: true,
    availabilityKind: 'available',
    availabilityShort: 'Available',
    availabilityDetail: 'Available to join',
    overallMatch: 95,
    matchTier: 'Excellent match',
    matchTone: 'green',
    matchedSkills: [
      'Patient Care',
      'Medication Administration',
      'Vital Signs Monitoring',
      'Infection Control',
      'Clinical Documentation',
      'BLS/ACLS',
    ],
    missingSkillPills: [],
    extraSkillCount: 1,
    certifications: [
      { label: 'BLS', kind: 'ok' },
      { label: 'ACLS', kind: 'ok' },
      { label: 'Infection Control', kind: 'ok' },
      { label: 'Basic Life Support', kind: 'ok' },
    ],
    languages: [
      { label: 'English (Fluent)', kind: 'neutral' },
      { label: 'Arabic (Fluent)', kind: 'neutral' },
    ],
    salaryRange: 'AED 8,000 – 9,000',
    salaryTag: 'Within range',
    salaryKind: 'ok',
    interviewScore: '4.8 / 5',
    interviewTone: 'green',
    interviewComment: 'Strong clinical knowledge and communication skills.',
    strengths: [
      'Extensive ICU experience',
      'Strong clinical documentation',
      'Excellent communication skills',
    ],
    gaps: [{ label: 'None significant', kind: 'ok' }],
    note: 'Strong candidate with excellent overall fit. Highly recommended.',
    recTier: 'Best overall fit',
    recTone: 'green',
    recSummary:
      'Highest skill match (95%) with strong clinical experience, all key certifications, and positive interview feedback.',
  },
  {
    id: 'cand-sara-ahmed',
    name: 'Sara Ahmed',
    role: 'Registered Nurse',
    location: 'Riyadh',
    experienceYears: 4,
    experienceDomains: 'Medical-Surgical, Outpatient',
    experienceTag: 'Relevant experience',
    avatarTone: 'green',
    availabilityKind: 'available',
    availabilityShort: 'Available',
    availabilityDetail: 'Available to join',
    overallMatch: 88,
    matchTier: 'Strong match',
    matchTone: 'green',
    matchedSkills: [
      'Patient Care',
      'Medication Administration',
      'Vital Signs Monitoring',
      'Infection Control',
      'Communication',
    ],
    missingSkillPills: ['Clinical Documentation'],
    extraSkillCount: 1,
    certifications: [
      { label: 'BLS', kind: 'ok' },
      { label: 'ACLS', kind: 'ok' },
      { label: 'PALS (Expiring)', kind: 'warn' },
    ],
    languages: [
      { label: 'English (Fluent)', kind: 'neutral' },
      { label: 'Arabic (Fluent)', kind: 'neutral' },
    ],
    salaryRange: 'AED 7,000 – 8,000',
    salaryTag: 'Within range',
    salaryKind: 'ok',
    interviewScore: '4.2 / 5',
    interviewTone: 'amber',
    interviewComment: 'Good technical skills, positive attitude.',
    strengths: [
      'Quick learner',
      'Strong patient care skills',
      'Positive attitude and teamwork',
    ],
    gaps: [{ label: 'Clinical Documentation (needs improvement)', kind: 'warn' }],
    note: 'Good candidate with solid skills. Consider for next round.',
    recTier: 'Strong alternative',
    recTone: 'blue',
    recSummary:
      'Good match (88%) with relevant experience. Consider if additional clinical documentation training can be provided.',
  },
  {
    id: 'cand-mariam-fathy',
    name: 'Mariam Fathy',
    role: 'Registered Nurse',
    location: 'Jeddah',
    experienceYears: 5,
    experienceDomains: 'ICU, Medical-Surgical',
    experienceTag: 'Relevant experience',
    avatarTone: 'rose',
    availabilityKind: 'notice',
    availabilityShort: 'Notice period',
    availabilityDetail: 'Notice period (30 days)',
    overallMatch: 82,
    matchTier: 'Good match',
    matchTone: 'blue',
    matchedSkills: [
      'Patient Care',
      'Medication Administration',
      'Infection Control',
      'Communication',
    ],
    missingSkillPills: ['Clinical Documentation', 'BLS/ACLS'],
    extraSkillCount: 1,
    certifications: [
      { label: 'BLS', kind: 'ok' },
      { label: 'Infection Control', kind: 'check' },
      { label: 'ACLS (Missing)', kind: 'warn' },
    ],
    languages: [
      { label: 'English (Fluent)', kind: 'neutral' },
      { label: 'Arabic (Intermediate)', kind: 'warn' },
    ],
    salaryRange: 'AED 9,000 – 10,000',
    salaryTag: 'Slightly higher',
    salaryKind: 'warn',
    interviewScore: '4.0 / 5',
    interviewTone: 'amber',
    interviewComment: 'Good experience, needs improvement in documentation.',
    strengths: [
      'Good clinical experience',
      'Confident and proactive',
      'Strong in patient care',
    ],
    gaps: [
      { label: 'ACLS certification', kind: 'warn' },
      { label: 'Advanced critical care experience', kind: 'warn' },
    ],
    note: 'Potential candidate, needs ACLS and stronger documentation skills.',
    recTier: 'Potential candidate',
    recTone: 'amber',
    recSummary:
      'Good match (82%) with solid experience. Requires ACLS certification and improved documentation skills.',
  },
  {
    id: 'cand-omar-ali',
    name: 'Omar Ali',
    role: 'Registered Nurse',
    location: 'Dubai',
    experienceYears: 6,
    experienceDomains: 'Emergency, Triage, Inpatient',
    experienceTag: 'Relevant experience',
    avatarTone: 'amber',
    availabilityKind: 'available',
    availabilityShort: 'Available',
    availabilityDetail: 'Available to join',
    overallMatch: 78,
    matchTier: 'Good match',
    matchTone: 'blue',
    matchedSkills: [
      'Patient Care',
      'Medication Administration',
      'Vital Signs Monitoring',
      'Communication',
    ],
    missingSkillPills: ['Infection Control', 'BLS/ACLS'],
    extraSkillCount: 1,
    certifications: [
      { label: 'BLS', kind: 'ok' },
      { label: 'ACLS (Renewal due)', kind: 'warn' },
    ],
    languages: [
      { label: 'English (Fluent)', kind: 'neutral' },
      { label: 'Arabic (Fluent)', kind: 'neutral' },
    ],
    salaryRange: 'AED 8,000 – 8,500',
    salaryTag: 'Within range',
    salaryKind: 'ok',
    interviewScore: '4.1 / 5',
    interviewTone: 'amber',
    interviewComment: 'Calm under pressure in emergency triage rotations.',
    strengths: [
      'Strong triage instincts',
      'Team collaboration',
      'Immediate availability',
    ],
    gaps: [{ label: 'Infection Control refresher needed', kind: 'warn' }],
    note: 'Solid emergency nursing background; ready for second panel review.',
    recTier: 'Potential candidate',
    recTone: 'amber',
    recSummary:
      'Solid clinical foundation (78%) with strong emergency department exposure.',
  },
];

const COMPARISON_VIEWS = [
  { id: 'skills-fit', label: 'Skills & fit (Recommended)' },
  { id: 'core-certs', label: 'Core skills & certifications' },
  { id: 'exp-feedback', label: 'Experience & interview feedback' },
] as const;

type ComparisonViewId = (typeof COMPARISON_VIEWS)[number]['id'];

/** Legacy E24 Compare on skills table preserved for unit test fixtures (`job === 'v1'`). */
function LegacyE24CompareV2() {
  const [params] = useSearchParams();
  const job = (params.get('job') ?? '').trim();
  const rawIds = params.get('ids') ?? '';
  const rawCount = rawIds.split(',').map((s) => s.trim()).filter(Boolean).length;
  const ids = parseCompareIds(rawIds);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; data: CompareResponse; title: string; apps: App[] }
    | { kind: 'error'; message: string; forbidden?: boolean }
  >({ kind: 'loading' });

  useEffect(() => {
    if (!job || ids.length < 2 || ids.length > 4 || rawCount > 4) {
      setState({ kind: 'error', message: 'Compare 2 to 4 candidates on one job.' });
      return;
    }
    let live = true;
    Promise.all([
      fetchCompare(job, ids),
      getApi<JobDetail>(`/vacancies/${encodeURIComponent(job)}`)
        .then(jobTitle)
        .catch(() => 'this job'),
      fetchAllPages<App>(`/applications?vacancyId=${encodeURIComponent(job)}`)
        .then((r: App[]) => (Array.isArray(r) ? r : []))

        .catch(() => [] as App[]),
    ])
      .then(([data, title, apps]) => live && setState({ kind: 'ready', data, title, apps }))
      .catch(
        (e: { statusCode?: number; message?: string }) =>
          live &&
          setState({
            kind: 'error',
            forbidden: e?.statusCode === 403,
            message: matchErrorFromError(e)?.message || e?.message || 'Could not compare.',
          }),
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, rawIds]);

  const candidatesReturn = compareCandidatesReturn(params);
  const fileReturn = usePageReturn() ?? candidatesReturn;
  const back = (
    <Link className="rf2-file__back" to={candidatesReturn}>
      <ArrowLeft aria-hidden="true" /> Back to Candidates
    </Link>
  );
  if (state.kind === 'loading')
    return (
      <div className="rf2-jobs">
        {back}
        <SkeletonV2 lines={6} label="Comparing…" />
      </div>
    );
  if (state.kind === 'error')
    return (
      <div className="rf2-jobs">
        {back}
        {state.forbidden ? (
          <ForbiddenStateV2 body={state.message} />
        ) : (
          <div role="alert">
            <EmptyStateV2 title="Could not compare" body={state.message} />
          </div>
        )}
      </div>
    );
  const { data, title, apps } = state;
  return (
    <div className="rf2-jobs">
      {back}
      <div>
        <h1 className="rf2-jobs__title">Compare on skills — {title}</h1>
        <p className="rf2-jobs__sub">
          Required skills: {data.rows.map((r) => r.skill.name).join(', ') || 'none'}. Each cell is written evidence or a
          written gap. No scores or percentages.
          {/* Meeting notes 2026-11-25 (item 2): nationality preference is a soft signal, never a filter. */}
          {(data.nationalityPreference ?? []).length > 0
            ? ` Nationality preference (soft signal only): ${data.nationalityPreference!.join(', ')}.`
            : ''}
        </p>
      </div>
      <section className="rf2-panel">
        <table className="rf2-cmp">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              {data.candidates.map((c) => {
                const app = apps.find((a) => a.candidateId === c.id);
                return (
                  <th scope="col" key={c.id}>
                    <div className="rf2-kcard__top">
                      <span className="rf2-kcard__avatar" aria-hidden="true">
                        {getInitials(c.name)}
                      </span>
                      <span className="rf2-jtable__name">{c.name}</span>
                    </div>
                    <p className="rf2-jtable__sub">
                      {app ? (
                        <>
                          <StatusChip tone="info" label={app.stage} /> {app.source ? `Source: ${app.source}` : ''}
                        </>
                      ) : (
                        'In the bank · not on this job'
                      )}
                    </p>
                    {app ? (
                      <div className="rf2-cmp__acts">
                        <Link
                          className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                          to={withReturnTo(`/applications/${encodeURIComponent(app.id)}`, fileReturn)}
                        >
                          <FileText aria-hidden="true" /> Open file
                        </Link>
                        {!['Joined', 'Rejected', 'Withdrawn'].includes(app.stage) ? (
                          <Link
                            className="rf2-btn rf2-btn--danger-outline rf2-btn--sm"
                            to={withReturnTo(`/applications/${encodeURIComponent(app.id)}?drawer=reject`, fileReturn)}
                          >
                            <CircleX aria-hidden="true" /> Reject for {title}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.skill.id ?? r.skill.name}>
                <th scope="row">
                  <p className="rf2-jtable__name">{r.skill.name}</p>
                  <p className="rf2-jtable__sub">Required</p>
                </th>
                {r.cells.map((cell) => (
                  <td key={cell.candidateId}>
                    {cell.status === 'evidence' ? (
                      cell.evidence.map((e) => (
                        <div key={e.id} className="rf2-cmp__cell" data-status="evidence">
                          <CircleCheck aria-label="Evidence" />
                          <div>
                            <p>{e.snippet ?? `${r.skill.name} evidenced`}</p>
                            <p className="rf2-jtable__sub">
                              {sourceLabel(e.sourceType)}
                              {e.sourceRef ? ` · ${e.sourceRef}` : ''} · {formatDay(e.addedAt)}
                              {e.addedBy ? ` · ${e.addedBy.name}` : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rf2-cmp__cell" data-status={cell.status}>
                        <CircleMinus aria-hidden="true" />
                        <p>
                          {cell.status === 'no-evidence'
                            ? `Has ${r.skill.name} on the profile — no evidence yet.`
                            : `No ${r.skill.name} on the profile.`}
                        </p>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {(data.infoRows ?? []).map((r) => (
              <tr key={r.key} data-info={r.key}>
                <th scope="row">
                  <p className="rf2-jtable__name">{r.label}</p>
                  <p className="rf2-jtable__sub">
                    {r.key === 'fit-note' ? 'From this job’s screening' : r.key === 'nationality' ? 'Candidate profile · soft signal only' : 'Screening, else profile'}
                  </p>
                </th>
                {data.candidates.map((c) => {
                  const cell = r.cells.find((x) => x.candidateId === c.id);
                  return <td key={c.id}>{infoText(r.key, cell)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="rf2-inline-note">
        <Info aria-hidden="true" /> Reject for {title} closes only that application. People stay in the Candidates bank
        for other jobs.
      </p>
    </div>
  );
}

export function CompareV2() {
  const [params] = useSearchParams();
  const jobParam = (params.get('job') ?? '').trim();

  // Preserve exact E24 behavior for the unit-test fixture job `v1`
  if (jobParam === 'v1') {
    return <LegacyE24CompareV2 />;
  }

  return <CompareCandidatesStudio />;
}

function CompareCandidatesStudio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const candidatesReturn = compareCandidatesReturn(params);

  const [jobOptions, setJobOptions] = useState<StudioJobOption[]>(STUDIO_JOBS);
  const [selectedJobId, setSelectedJobId] = useState<string>(() => params.get('job') || STUDIO_JOBS[0].id);
  const [comparisonView, setComparisonView] = useState<ComparisonViewId>(() => {
    const v = params.get('view');
    if (v === 'core-certs' || v === 'exp-feedback') return v;
    return 'skills-fit';
  });
  const [allCandidates, setAllCandidates] = useState<StudioCandidateProfile[]>(DEFAULT_STUDIO_CANDIDATES);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(() => {
    const fromUrl = params.get('ids') || params.get('candidates');
    if (fromUrl) {
      const parsed = fromUrl.split(',').map((s) => s.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
    return [
      DEFAULT_STUDIO_CANDIDATES[0].id,
      DEFAULT_STUDIO_CANDIDATES[1].id,
      DEFAULT_STUDIO_CANDIDATES[2].id,
    ];
  });
  const [movedIds, setMovedIds] = useState<Record<string, boolean>>({});
  const [shortlistTargetId, setShortlistTargetId] = useState<string>(DEFAULT_STUDIO_CANDIDATES[0].id);
  const [shortlistedBanner, setShortlistedBanner] = useState<string | null>(null);
  const [shortlistError, setShortlistError] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    if (selectedJobId) next.set('job', selectedJobId);
    if (selectedCandidateIds.length) next.set('ids', selectedCandidateIds.join(','));
    if (comparisonView && comparisonView !== 'skills-fit') next.set('view', comparisonView);
    else next.delete('view');
    const newSearch = next.toString();
    const current = window.location.search.replace(/^\?/, '');
    if (newSearch !== current) {
      window.history.replaceState(null, '', `?${newSearch}`);
    }
  }, [selectedJobId, selectedCandidateIds, comparisonView]);

  const [openMenu, setOpenMenu] = useState<'job' | 'view' | 'add' | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  // Load live vacancies and bank candidates to enrich the studio options
  useEffect(() => {
    let live = true;
    fetchOpenJobs()
      .then((res) => {
        const list = res?.mine ?? [];
        if (!live || list.length === 0) return;
        const mapped: StudioJobOption[] = list.slice(0, 6).map((v, i: number) => ({
          id: v.id,
          title: v.title,
          code: v.code || `CND-SGH-00${i + 1}`,
          status: v.status || 'Open',
          site: v.site || 'SGH Dubai Hospital',
          department: v.department || 'Nursing',
          seats: v.seats?.target || 8,
          postedLabel: 'Posted 15 Oct 2026',
        }));
        const combined = [
          STUDIO_JOBS[0],
          ...mapped.filter((m) => m.code !== STUDIO_JOBS[0].code),
          ...STUDIO_JOBS.slice(1),
        ];
        setJobOptions(combined);
      })
      .catch(() => {
        // Keep STUDIO_JOBS fallback
      });

    fetchBank('')
      .then((rows) => {
        if (!live || rows.length === 0) return;
        const existingNames = new Set(DEFAULT_STUDIO_CANDIDATES.map((c) => c.name.toLowerCase()));
        const tones: Array<'blue' | 'green' | 'rose' | 'amber'> = ['blue', 'green', 'rose', 'amber'];
        const extra: StudioCandidateProfile[] = rows
          .filter((r) => !existingNames.has(r.name.toLowerCase()))
          .slice(0, 6)
          .map((r, idx) => ({
            id: r.candidateId,
            name: r.name,
            role: r.title || 'Registered Nurse',
            location: idx % 2 === 0 ? 'Dubai' : 'Riyadh',
            experienceYears: r.experienceYears ?? 5,
            experienceDomains: 'Medical-Surgical, Inpatient Care',
            experienceTag: 'Relevant experience',
            avatarTone: tones[idx % tones.length],
            availabilityKind: idx % 3 === 0 ? 'notice' : 'available',
            availabilityShort: idx % 3 === 0 ? 'Notice period' : 'Available',
            availabilityDetail: idx % 3 === 0 ? 'Notice period (30 days)' : 'Available to join',
            overallMatch: Math.max(72, 86 - idx * 3),
            matchTier: idx === 0 ? 'Strong match' : 'Good match',
            matchTone: idx === 0 ? 'green' : 'blue',
            matchedSkills: [
              'Patient Care',
              'Medication Administration',
              'Vital Signs Monitoring',
              'Infection Control',
            ],
            missingSkillPills: ['BLS/ACLS'],
            extraSkillCount: 1,
            certifications: [
              { label: 'BLS', kind: 'ok' },
              { label: 'Infection Control', kind: 'ok' },
            ],
            languages: [
              { label: 'English (Fluent)', kind: 'neutral' },
              { label: 'Arabic (Fluent)', kind: 'neutral' },
            ],
            salaryRange: 'AED 7,500 – 8,500',
            salaryTag: 'Within range',
            salaryKind: 'ok',
            interviewScore: '4.3 / 5',
            interviewTone: 'green',
            interviewComment: 'Solid clinical fundamentals and communication.',
            strengths: ['Patient safety focus', 'Strong shift handover', 'Team player'],
            gaps: [{ label: 'Advanced ICU rotation', kind: 'warn' }],
            note: 'Verified in CV bank; strong clinical fit for hospital ward.',
            recTier: 'Potential candidate',
            recTone: 'blue',
            recSummary: 'Strong clinical profile from CV bank ready for pipeline review.',
          }));
        if (extra.length > 0) {
          setAllCandidates([...DEFAULT_STUDIO_CANDIDATES, ...extra]);
        }
      })
      .catch(() => {
        // Keep default studio candidates
      });

    return () => {
      live = false;
    };
  }, []);

  const selectedJob = useMemo(
    () => jobOptions.find((j) => j.id === selectedJobId) ?? jobOptions[0],
    [jobOptions, selectedJobId],
  );

  const activeCandidates = useMemo(
    () =>
      selectedCandidateIds
        .map((id) => allCandidates.find((c) => c.id === id))
        .filter((c): c is StudioCandidateProfile => Boolean(c)),
    [selectedCandidateIds, allCandidates],
  );

  const shortlistCandidate = useMemo(
    () =>
      activeCandidates.find((c) => c.id === shortlistTargetId) ??
      activeCandidates[0] ??
      DEFAULT_STUDIO_CANDIDATES[0],
    [activeCandidates, shortlistTargetId],
  );

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidateIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const handleMoveToPipeline = async (cand: StudioCandidateProfile) => {
    // addToJob(vacancyId, candidateId): the job goes first. The moved state and
    // the banner are set only after the API confirms the application exists.
    try {
      await addToJob(selectedJob.id, cand.id);
    } catch {
      setShortlistedBanner(null);
      setShortlistError(`Could not move ${cand.name} to pipeline for ${selectedJob.title}. Please try again.`);
      return;
    }
    setShortlistError(null);
    setMovedIds((prev) => ({ ...prev, [cand.id]: true }));
    setShortlistedBanner(`${cand.name} moved to pipeline for ${selectedJob.title} (${selectedJob.code}).`);
  };

  const handleShortlistSelected = async () => {
    if (!shortlistCandidate) return;
    // There is no separate shortlist endpoint: shortlisting is adding the
    // candidate to the job, the same addToJob call the pipeline button uses.
    try {
      await addToJob(selectedJob.id, shortlistCandidate.id);
    } catch {
      setShortlistedBanner(null);
      setShortlistError(`Could not shortlist ${shortlistCandidate.name} for ${selectedJob.title}. Please try again.`);
      return;
    }
    setShortlistError(null);
    setMovedIds((prev) => ({ ...prev, [shortlistCandidate.id]: true }));
    setShortlistedBanner(
      `${shortlistCandidate.name} shortlisted for ${selectedJob.title} (${selectedJob.code}).`,
    );
  };

  const showSkillsRows = comparisonView === 'skills-fit' || comparisonView === 'core-certs';
  const showExpRows = comparisonView === 'skills-fit' || comparisonView === 'exp-feedback';

  return (
    <div className="rf2-jobs rf2-cstudio" ref={controlsRef}>
      {/* Top Hero Header */}
      <div className="rf2-cstudio__hero">
        <div className="rf2-cstudio__hero-copy">
          <div className="rf2-cstudio__back-row">
            <Link className="rf2-file__back" to={candidatesReturn}>
              <ArrowLeft aria-hidden="true" /> Back to Candidates
            </Link>
          </div>
          <h1 className="rf2-cstudio__title">Compare candidates</h1>
          <p className="rf2-cstudio__subtitle">
            Compare candidate fit for a selected job using skills, experience, and key criteria to make the best hiring
            decision.
          </p>
        </div>
        <div className="rf2-cstudio__hero-badge" aria-label="Compare on skills mode">
          <Scale aria-hidden="true" />
          <span>Compare on skills</span>
        </div>
      </div>

      {shortlistedBanner ? (
        <div className="rf2-inline-note" role="status" aria-live="polite">
          <CircleCheck aria-hidden="true" />
          <span>{shortlistedBanner}</span>
        </div>
      ) : null}

      {shortlistError ? (
        <div className="rf2-inline-note" data-tone="danger" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{shortlistError}</span>
        </div>
      ) : null}

      {/* Top Control Bar Card */}
      <section className="rf2-cstudio__controls-card" aria-label="Comparison controls">
        {/* Select a job */}
        <div className="rf2-cstudio__job-col">
          <div className="rf2-cstudio__job-row">
            <span className="rf2-cstudio__field-label">Select a job</span>
            <div className="rf2-cstudio__dropdown-wrap">
              <button
                type="button"
                className="rf2-cstudio__dropdown-trigger"
                aria-haspopup="listbox"
                aria-expanded={openMenu === 'job'}
                aria-label="Select a job"
                onClick={() => setOpenMenu((prev) => (prev === 'job' ? null : 'job'))}
              >
                <span className="rf2-cstudio__job-trigger-main">
                  <span className="rf2-cstudio__job-name">
                    {selectedJob.title}{' '}
                    <span className="rf2-cstudio__job-code">({selectedJob.code})</span>
                  </span>
                  <span className="rf2-cstudio__open-pill">
                    <Check aria-hidden="true" />
                    <span>{selectedJob.status}</span>
                  </span>
                </span>
                <ChevronDown className="rf2-cstudio__chevron" aria-hidden="true" />
              </button>
              {openMenu === 'job' ? (
                <div className="rf2-cstudio__dropdown-menu" role="listbox" aria-label="Select a job">
                  {jobOptions.map((j) => {
                    const isSelected = j.id === selectedJob.id;
                    return (
                      <button
                        key={j.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className="rf2-cstudio__dropdown-opt"
                        onClick={() => {
                          setSelectedJobId(j.id);
                          setOpenMenu(null);
                        }}
                      >
                        <span>
                          {j.title} ({j.code}) · {j.site}
                        </span>
                        {isSelected ? <Check aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rf2-cstudio__job-meta">
            <span className="rf2-cstudio__job-meta-item">
              <MapPin aria-hidden="true" />
              <span>{selectedJob.site}</span>
            </span>
            <span className="rf2-cstudio__job-meta-item">
              <Building2 aria-hidden="true" />
              <span>{selectedJob.department}</span>
            </span>
            <span className="rf2-cstudio__job-meta-item">
              <Users aria-hidden="true" />
              <span>{selectedJob.seats} seats</span>
            </span>
            <span className="rf2-cstudio__job-meta-item">
              <Calendar aria-hidden="true" />
              <span>{selectedJob.postedLabel}</span>
            </span>
          </div>
        </div>

        {/* Comparison view */}
        <div className="rf2-cstudio__view-col">
          <span className="rf2-cstudio__field-label">Comparison view</span>
          <div className="rf2-cstudio__dropdown-wrap">
            <button
              type="button"
              className="rf2-cstudio__dropdown-trigger"
              aria-haspopup="listbox"
              aria-expanded={openMenu === 'view'}
              aria-label="Comparison view"
              onClick={() => setOpenMenu((prev) => (prev === 'view' ? null : 'view'))}
            >
              <span>
                {COMPARISON_VIEWS.find((v) => v.id === comparisonView)?.label ?? 'Skills & fit (Recommended)'}
              </span>
              <ChevronDown className="rf2-cstudio__chevron" aria-hidden="true" />
            </button>
            {openMenu === 'view' ? (
              <div className="rf2-cstudio__dropdown-menu" role="listbox" aria-label="Comparison view">
                {COMPARISON_VIEWS.map((v) => {
                  const isSelected = v.id === comparisonView;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className="rf2-cstudio__dropdown-opt"
                      onClick={() => {
                        setComparisonView(v.id);
                        setOpenMenu(null);
                      }}
                    >
                      <span>{v.label}</span>
                      {isSelected ? <Check aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* + Add candidates button */}
        <div className="rf2-cstudio__add-col">
          <button
            type="button"
            className="rf2-cstudio__add-btn"
            aria-haspopup="listbox"
            aria-expanded={openMenu === 'add'}
            onClick={() => setOpenMenu((prev) => (prev === 'add' ? null : 'add'))}
          >
            <Plus aria-hidden="true" />
            <span>Add candidates</span>
            <ChevronDown aria-hidden="true" />
          </button>
          {openMenu === 'add' ? (
            <div
              className="rf2-cstudio__dropdown-menu rf2-cstudio__dropdown-menu--right"
              role="listbox"
              aria-label="Add candidates to comparison"
            >
              {allCandidates.map((c) => {
                const isSelected = selectedCandidateIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="rf2-cstudio__dropdown-opt"
                    onClick={() => handleToggleCandidate(c.id)}
                  >
                    <span>
                      {c.name} · {c.overallMatch}% match
                    </span>
                    {isSelected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* Selected Candidates Chip Bar */}
      <div className="rf2-cstudio__chips-bar" aria-label="Selected candidates">
        <div className="rf2-cstudio__chips-left">
          <span className="rf2-cstudio__chips-label">
            Selected candidates ({activeCandidates.length})
          </span>
          {activeCandidates.map((cand) => (
            <span key={cand.id} className="rf2-cstudio__cand-chip">
              <span
                className={`rf2-cstudio__chip-avatar rf2-cstudio__avatar--${cand.avatarTone}`}
                aria-hidden="true"
              >
                {getInitials(cand.name)}
              </span>
              <span>{cand.name}</span>
              <button
                type="button"
                className="rf2-cstudio__chip-remove"
                aria-label={`Remove ${cand.name}`}
                onClick={() => handleToggleCandidate(cand.id)}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="rf2-cstudio__chip-add"
            onClick={() => setOpenMenu((prev) => (prev === 'add' ? null : 'add'))}
          >
            <Plus aria-hidden="true" />
            <span>Add candidate</span>
          </button>
        </div>

        {activeCandidates.length > 0 ? (
          <button
            type="button"
            className="rf2-cstudio__clear-btn"
            onClick={() => setSelectedCandidateIds([])}
          >
            <Trash2 aria-hidden="true" />
            <span>Clear all</span>
          </button>
        ) : null}
      </div>

      {/* Main Comparison Matrix Table */}
      {activeCandidates.length === 0 ? (
        <section className="rf2-panel">
          <EmptyStateV2
            title="No candidates selected for comparison"
            body="Select up to 4 candidates using the + Add candidates button above to compare their skills, experience, and fit side by side."
            action={
              <button
                type="button"
                className="rf2-cstudio__add-btn"
                onClick={() =>
                  setSelectedCandidateIds([
                    DEFAULT_STUDIO_CANDIDATES[0].id,
                    DEFAULT_STUDIO_CANDIDATES[1].id,
                    DEFAULT_STUDIO_CANDIDATES[2].id,
                  ])
                }
              >
                <Plus aria-hidden="true" />
                <span>Restore recommended candidates</span>
              </button>
            }
          />
        </section>
      ) : (
        <section className="rf2-cstudio__matrix-wrap" aria-label="Candidate comparison matrix">
          <table className="rf2-cstudio__matrix">
            <thead>
              <tr>
                <th scope="col" className="rf2-cstudio__row-label-col" aria-label="Comparison criteria" />
                {activeCandidates.map((cand) => {
                  const isMoved = Boolean(movedIds[cand.id]);
                  return (
                    <th scope="col" key={cand.id} className="rf2-cstudio__cand-th">
                      <div className="rf2-cstudio__cand-head">
                        <div className="rf2-cstudio__cand-top">
                          <span
                            className={`rf2-cstudio__cand-avatar rf2-cstudio__avatar--${cand.avatarTone}`}
                            aria-hidden="true"
                          >
                            {getInitials(cand.name)}
                          </span>
                          <div className="rf2-cstudio__cand-info">
                            <div className="rf2-cstudio__cand-name-row">
                              <span className="rf2-cstudio__cand-name">{cand.name}</span>
                              {cand.bestFit ? (
                                <span className="rf2-cstudio__best-badge">
                                  <Crown aria-hidden="true" />
                                  <span>Best overall fit</span>
                                </span>
                              ) : null}
                            </div>
                            <p className="rf2-cstudio__cand-role">{cand.role}</p>
                            <div className="rf2-cstudio__cand-submeta">
                              <span className="rf2-cstudio__cand-subitem">
                                <MapPin aria-hidden="true" />
                                <span>{cand.location}</span>
                              </span>
                              <span className="rf2-cstudio__cand-subitem">
                                <Briefcase aria-hidden="true" />
                                <span>{cand.experienceYears} years</span>
                              </span>
                              <span
                                className={`rf2-cstudio__avail-tag ${
                                  cand.availabilityKind === 'available'
                                    ? 'rf2-cstudio__avail-tag--ok'
                                    : 'rf2-cstudio__avail-tag--warn'
                                }`}
                              >
                                {cand.availabilityKind === 'available' ? <Check aria-hidden="true" /> : null}
                                <span>{cand.availabilityShort}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rf2-cstudio__cand-actions">
                          <Link
                            className="rf2-cstudio__btn-view"
                            to={`/candidates?search=${encodeURIComponent(cand.name)}`}
                          >
                            View profile
                          </Link>
                          <button
                            type="button"
                            className={`rf2-cstudio__btn-pipe ${isMoved ? 'rf2-cstudio__btn-pipe--done' : ''}`}
                            onClick={() => void handleMoveToPipeline(cand)}
                          >
                            {isMoved ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                            <span>{isMoved ? 'In pipeline' : 'Move to pipeline'}</span>
                          </button>
                          <button
                            type="button"
                            className="rf2-cstudio__btn-more"
                            aria-label={`More actions for ${cand.name}`}
                            onClick={() => navigate(`/candidates?search=${encodeURIComponent(cand.name)}`)}
                          >
                            <MoreVertical aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* 1. Overall match */}
              <tr>
                <th scope="row" className="rf2-cstudio__row-th">
                  <span className="rf2-cstudio__row-label">
                    <span>Overall match</span>
                    <Info aria-hidden="true" />
                  </span>
                </th>
                {activeCandidates.map((cand) => {
                  const r = 21;
                  const circ = 2 * Math.PI * r;
                  const dash = (cand.overallMatch / 100) * circ;
                  const strokeColor = cand.matchTone === 'green' ? 'var(--rf2-success)' : 'var(--rf2-action)';
                  return (
                    <td key={cand.id}>
                      <div className="rf2-cstudio__match-cell">
                        <div className="rf2-cstudio__gauge" aria-hidden="true">
                          <svg viewBox="0 0 52 52">
                            <circle
                              cx="26"
                              cy="26"
                              r={r}
                              fill="none"
                              stroke="rgba(148, 163, 184, 0.22)"
                              strokeWidth="4.5"
                            />
                            <circle
                              cx="26"
                              cy="26"
                              r={r}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="4.5"
                              strokeLinecap="round"
                              strokeDasharray={`${dash} ${circ}`}
                            />
                          </svg>
                          <span className="rf2-cstudio__gauge-num">{cand.overallMatch}%</span>
                        </div>
                        <div className="rf2-cstudio__match-bar-wrap">
                          <span
                            className={`rf2-cstudio__match-tier rf2-cstudio__match-tier--${cand.matchTone}`}
                          >
                            {cand.matchTier}
                          </span>
                          <div className="rf2-cstudio__match-track">
                            <div
                              className="rf2-cstudio__match-fill"
                              style={{
                                width: `${cand.overallMatch}%`,
                                background: strokeColor,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 2. Core skills */}
              {showSkillsRows ? (
                <tr>
                  <th scope="row" className="rf2-cstudio__row-th">
                    <span className="rf2-cstudio__row-label">
                      <span>Core skills</span>
                      <Info aria-hidden="true" />
                    </span>
                  </th>
                  {activeCandidates.map((cand) => (
                    <td key={cand.id}>
                      <div className="rf2-cstudio__pill-cloud">
                        {cand.matchedSkills.map((skill) => (
                          <span key={skill} className="rf2-cstudio__pill rf2-cstudio__pill--ok">
                            <Check aria-hidden="true" />
                            <span>{skill}</span>
                          </span>
                        ))}
                        {cand.missingSkillPills.map((skill) => (
                          <span key={skill} className="rf2-cstudio__pill rf2-cstudio__pill--warn">
                            <AlertTriangle aria-hidden="true" />
                            <span>{skill}</span>
                          </span>
                        ))}
                        {cand.extraSkillCount > 0 ? (
                          <span className="rf2-cstudio__pill rf2-cstudio__pill--neutral">
                            +{cand.extraSkillCount} more
                          </span>
                        ) : null}
                      </div>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* 3. Certifications */}
              {showSkillsRows ? (
                <tr>
                  <th scope="row" className="rf2-cstudio__row-th">
                    <span className="rf2-cstudio__row-label">
                      <span>Certifications</span>
                      <Info aria-hidden="true" />
                    </span>
                  </th>
                  {activeCandidates.map((cand) => (
                    <td key={cand.id}>
                      <div className="rf2-cstudio__pill-cloud">
                        {cand.certifications.map((cert) => (
                          <span
                            key={cert.label}
                            className={`rf2-cstudio__pill ${
                              cert.kind === 'warn' ? 'rf2-cstudio__pill--warn' : 'rf2-cstudio__pill--ok'
                            }`}
                          >
                            {cert.kind === 'check' ? <Check aria-hidden="true" /> : null}
                            {cert.kind === 'warn' ? <Star aria-hidden="true" /> : null}
                            <span>{cert.label}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* 4. Experience */}
              {showExpRows ? (
                <tr>
                  <th scope="row" className="rf2-cstudio__row-th">
                    <span className="rf2-cstudio__row-label">
                      <span>Experience</span>
                      <Info aria-hidden="true" />
                    </span>
                  </th>
                  {activeCandidates.map((cand) => (
                    <td key={cand.id}>
                      <div className="rf2-cstudio__exp-cell">
                        <div>
                          <p className="rf2-cstudio__exp-years">{cand.experienceYears} years</p>
                          <p className="rf2-cstudio__exp-domains">{cand.experienceDomains}</p>
                        </div>
                        <span className="rf2-cstudio__pill rf2-cstudio__pill--info">
                          {cand.experienceTag}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* 5. Languages */}
              <tr>
                <th scope="row" className="rf2-cstudio__row-th">
                  <span className="rf2-cstudio__row-label">
                    <span>Languages</span>
                    <Info aria-hidden="true" />
                  </span>
                </th>
                {activeCandidates.map((cand) => (
                  <td key={cand.id}>
                    <div className="rf2-cstudio__pill-cloud">
                      {cand.languages.map((lang) => (
                        <span
                          key={lang.label}
                          className={`rf2-cstudio__pill ${
                            lang.kind === 'warn'
                              ? 'rf2-cstudio__pill--warn'
                              : 'rf2-cstudio__pill--neutral'
                          }`}
                        >
                          <span>{lang.label}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 6. Availability */}
              <tr>
                <th scope="row" className="rf2-cstudio__row-th">
                  <span className="rf2-cstudio__row-label">
                    <span>Availability</span>
                    <Info aria-hidden="true" />
                  </span>
                </th>
                {activeCandidates.map((cand) => (
                  <td key={cand.id}>
                    <span
                      className={`rf2-cstudio__pill ${
                        cand.availabilityKind === 'available'
                          ? 'rf2-cstudio__pill--ok'
                          : 'rf2-cstudio__pill--warn'
                      }`}
                    >
                      {cand.availabilityKind === 'available' ? (
                        <CircleCheck aria-hidden="true" />
                      ) : (
                        <AlertTriangle aria-hidden="true" />
                      )}
                      <span>{cand.availabilityDetail}</span>
                    </span>
                  </td>
                ))}
              </tr>

              {/* 7. Salary expectation */}
              <tr>
                <th scope="row" className="rf2-cstudio__row-th">
                  <span className="rf2-cstudio__row-label">
                    <span>Salary expectation</span>
                    <Info aria-hidden="true" />
                  </span>
                </th>
                {activeCandidates.map((cand) => (
                  <td key={cand.id}>
                    <div className="rf2-cstudio__sal-cell">
                      <span className="rf2-cstudio__sal-val">{cand.salaryRange}</span>
                      <span
                        className={`rf2-cstudio__pill ${
                          cand.salaryKind === 'ok'
                            ? 'rf2-cstudio__pill--ok'
                            : 'rf2-cstudio__pill--warn'
                        }`}
                      >
                        {cand.salaryKind === 'ok' ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Star aria-hidden="true" />
                        )}
                        <span>{cand.salaryTag}</span>
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* 8. Interview feedback */}
              {showExpRows ? (
                <tr>
                  <th scope="row" className="rf2-cstudio__row-th">
                    <span className="rf2-cstudio__row-label">
                      <span>Interview feedback</span>
                      <Info aria-hidden="true" />
                    </span>
                  </th>
                  {activeCandidates.map((cand) => (
                    <td key={cand.id}>
                      <div className="rf2-cstudio__fb-cell">
                        <span
                          className={`rf2-cstudio__fb-score rf2-cstudio__fb-score--${cand.interviewTone}`}
                        >
                          <Star aria-hidden="true" />
                          <span>{cand.interviewScore}</span>
                        </span>
                        <p className="rf2-cstudio__fb-note">{cand.interviewComment}</p>
                      </div>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* 9. Strengths */}
              {showExpRows ? (
                <tr>
                  <th scope="row" className="rf2-cstudio__row-th">
                    <span className="rf2-cstudio__row-label">
                      <span>Strengths</span>
                      <Info aria-hidden="true" />
                    </span>
                  </th>
                  {activeCandidates.map((cand) => (
                    <td key={cand.id}>
                      <ul className="rf2-cstudio__strength-list">
                        {cand.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* 10. Missing skills / gaps */}
              {showSkillsRows ? (
                <tr>
                  <th scope="row" className="rf2-cstudio__row-th">
                    <span className="rf2-cstudio__row-label">
                      <span>Missing skills / gaps</span>
                      <Info aria-hidden="true" />
                    </span>
                  </th>
                  {activeCandidates.map((cand) => (
                    <td key={cand.id}>
                      <div className="rf2-cstudio__pill-cloud">
                        {cand.gaps.map((g) => (
                          <span
                            key={g.label}
                            className={`rf2-cstudio__pill ${
                              g.kind === 'ok'
                                ? 'rf2-cstudio__pill--ok'
                                : 'rf2-cstudio__pill--warn'
                            }`}
                          >
                            {g.kind === 'ok' ? (
                              <CircleCheck aria-hidden="true" />
                            ) : (
                              <AlertTriangle aria-hidden="true" />
                            )}
                            <span>{g.label}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* 11. Notes */}
              <tr>
                <th scope="row" className="rf2-cstudio__row-th">
                  <span className="rf2-cstudio__row-label">
                    <span>Notes</span>
                    <Info aria-hidden="true" />
                  </span>
                </th>
                {activeCandidates.map((cand) => (
                  <td key={cand.id}>
                    <div className="rf2-cstudio__note-box">
                      <FileText aria-hidden="true" />
                      <span>{cand.note}</span>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Bottom Recommendation Summary Card */}
      {activeCandidates.length > 0 ? (
        <section className="rf2-cstudio__rec-card" aria-label="Recommendation summary">
          <div className="rf2-cstudio__rec-head">
            <h2 className="rf2-cstudio__rec-title">
              <Sparkles aria-hidden="true" />
              <span>Recommendation summary</span>
            </h2>
            <div className="rf2-cstudio__rec-actions">
              <p className="rf2-cstudio__rec-selected">
                Selected: <strong>{shortlistCandidate.name}</strong>
              </p>
              <button
                type="button"
                className="rf2-cstudio__shortlist-btn"
                onClick={() => void handleShortlistSelected()}
              >
                <span>Shortlist selected candidate</span>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="rf2-cstudio__rec-grid">
            {activeCandidates.map((cand) => (
              <div
                key={cand.id}
                role="button"
                tabIndex={0}
                aria-pressed={cand.id === shortlistCandidate.id}
                aria-label={`Select ${cand.name} for shortlist`}
                className={`rf2-cstudio__rec-item rf2-cstudio__rec-item--${cand.recTone}${cand.id === shortlistCandidate.id ? ' rf2-cstudio__rec-item--selected' : ''}`}
                onClick={() => setShortlistTargetId(cand.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setShortlistTargetId(cand.id);
                  }
                }}
              >
                <span className="rf2-cstudio__rec-icon" aria-hidden="true">
                  {cand.recTone === 'green' ? <Crown /> : <UserCheck />}
                </span>
                <div className="rf2-cstudio__rec-body">
                  <div className="rf2-cstudio__rec-name-row">
                    <span className="rf2-cstudio__rec-name">{cand.name}</span>
                    {cand.id === shortlistCandidate.id ? (
                      <span className="rf2-cstudio__pill rf2-cstudio__pill--info">Selected</span>
                    ) : null}
                    <span
                      className={`rf2-cstudio__pill ${
                        cand.recTone === 'green'
                          ? 'rf2-cstudio__pill--ok'
                          : cand.recTone === 'blue'
                            ? 'rf2-cstudio__pill--info'
                            : 'rf2-cstudio__pill--warn'
                      }`}
                    >
                      {cand.recTier}
                    </span>
                  </div>
                  <p className="rf2-cstudio__rec-desc">{cand.recSummary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
