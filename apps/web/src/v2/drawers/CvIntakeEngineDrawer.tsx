import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  FileText,
  Link2,
  Plus,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import type { JdCriteriaDefinition, Vacancy } from '@recruitflow/contracts';
import {
  calculateCandidateFitScore,
  detectClinicalDomain,
  generateAISummary,
  type CriteriaBreakdown,
} from '@recruitflow/validation';
import { ButtonV2, DrawerV2, InputV2, SelectV2, StatusChip, TextareaV2 } from '../../components/v2';
import { ApiError } from '../../api/client';
import { fetchVacancyList } from '../../utils/vacancyAccess';
import {
  FIELD_LABEL,
  cvFileProblem,
  duplicateCheck,
  parseCv,
  saveValidatedCvIntake,
  splitName,
  type DuplicateCheckResult,
  type ExtractedCv,
  type ImportDecision,
  type ValidatedCvIntakeResult,
} from '../api/cvImport';
import { errorMessage } from '../api/jobs';
import { formatSkillLabel, parseSkillInput } from './skillFormat';
import './cv-intake-drawer.css';

const STEPS = ['Upload', 'Validate', 'Job Fit', 'Done'] as const;
const SOURCE_OPTIONS = ['CV Intake Upload', 'Direct Application', 'LinkedIn', 'Employee Referral', 'Agency', 'Career Portal'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ScoredOpenJob {
  vacancy: Vacancy;
  title: string;
  fit: CriteriaBreakdown;
}

export interface CvIntakeEngineDrawerProps {
  open: boolean;
  initialVacancyId?: string | null;
  initialCandidateId?: string | null;
  onClose: () => void;
  onCompleted?: (result: ValidatedCvIntakeResult) => void;
}

function vacancyTitle(v: Vacancy): string {
  return v.position?.title?.trim() || v.title?.trim() || 'Open Position';
}

function scoreOpenVacancies(profile: ExtractedCv | null, vacancies: Vacancy[]): ScoredOpenJob[] {
  if (!profile || vacancies.length === 0) return [];
  const candTitleLower = `${profile.title ?? ''} ${profile.clinicalDomain ?? ''}`.toLowerCase();
  const scored: ScoredOpenJob[] = vacancies.map((v) => {
    const title = vacancyTitle(v);
    const criteria = ((v as Vacancy & { jdCriteria?: unknown }).jdCriteria as JdCriteriaDefinition | null) ?? null;
    const requiredSkills = criteria?.mustHaveSkills?.length
      ? criteria.mustHaveSkills.map((s) => s.name)
      : (v.requiredSkills ?? []);
    const niceToHaveSkills = criteria?.niceToHaveSkills?.map((s) => s.name) ?? [];
    const rawFit = calculateCandidateFitScore(
      {
        skills: profile.skills ?? [],
        experienceYears: profile.experienceYears ?? null,
        location: profile.location ?? null,
        certifications: profile.certifications ?? [],
        currentTitle: profile.title ?? null,
        summary: profile.summary ?? null,
        rawText: profile.rawText ?? null,
        responsibilities: profile.responsibilities ?? null,
        projects: profile.projects ?? null,
        workHistory: profile.workHistory ?? null,
        education: profile.education ?? null,
        educationHistory: profile.educationHistory ?? null,
        projectHistory: profile.projectHistory ?? null,
        evidenceChunks: profile.evidenceChunks ?? null,
      },
      {
        requiredSkills,
        niceToHaveSkills,
        minExperienceYears: criteria?.minExperienceYears ?? v.minExperienceYears ?? 0,
        location: v.location || v.branch?.name || '',
        qualifications: [title, v.qualifications].filter(Boolean).join(' '),
        department: v.department || '',
      },
    );
    // Boost exact role-title alignment and prevent jobs with 0 configured required skills from outranking skill-matched roles
    const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const titleOverlap = titleWords.some((w) => candTitleLower.includes(w));
    const hasConfiguredSkills = requiredSkills.length > 0;
    const matchedCount = rawFit.breakdown.skills.matched.length;
    let adjustedScore = rawFit.score;
    if (!hasConfiguredSkills && !titleOverlap) {
      adjustedScore = Math.min(adjustedScore, 48);
    } else if (titleOverlap && (matchedCount > 0 || !hasConfiguredSkills)) {
      adjustedScore = Math.min(100, adjustedScore + 12);
    }
    const rounded = Math.round(adjustedScore);
    const summaryText = !hasConfiguredSkills && !titleOverlap
      ? 'No required skills configured on this role yet; evaluated on experience and location.'
      : rawFit.summaryText.replace(/\(\d+%\)/, `(${rounded}%)`);
    const fit: CriteriaBreakdown = {
      ...rawFit,
      score: rounded,
      matchLevel: rounded >= 70 ? 'high' : rounded >= 45 ? 'moderate' : 'low',
      summaryText,
    };
    return { vacancy: v, title, fit };
  });
  scored.sort((a, b) => {
    if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
    return b.fit.breakdown.skills.matched.length - a.fit.breakdown.skills.matched.length;
  });
  return scored;
}

function hasValidEmail(email?: string): boolean {
  return Boolean(email && EMAIL_RE.test(email.trim()));
}

function hasValidPhone(phone?: string): boolean {
  return (phone?.replace(/\D/g, '').length ?? 0) >= 7;
}

export function CvIntakeEngineDrawer({
  open,
  initialVacancyId,
  initialCandidateId,
  onClose,
  onCompleted,
}: CvIntakeEngineDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed & editable candidate state
  const [profile, setProfile] = useState<ExtractedCv | null>(null);
  const [initialProfile, setInitialProfile] = useState<ExtractedCv | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');

  // Active open vacancies for real-time job fit scoring
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(false);

  // Step 3: Duplicate resolution & target job assignment
  const [checkingDup, setCheckingDup] = useState(false);
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [dupError, setDupError] = useState<string | null>(null);
  const [decision, setDecision] = useState<ImportDecision>(
    initialCandidateId ? { kind: 'link', candidateId: initialCandidateId } : { kind: 'create' },
  );
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(initialVacancyId || 'pool');
  const [userPickedVacancy, setUserPickedVacancy] = useState(Boolean(initialVacancyId));
  const [source, setSource] = useState<string>('CV Intake Upload');

  // Step 4: Save & Confirmation
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<ValidatedCvIntakeResult | null>(null);

  // Fetch active open vacancies whenever drawer opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingVacancies(true);
    fetchVacancyList<Vacancy>('/vacancies?page=1&pageSize=100')
      .then(({ full }) => {
        if (!alive) return;
        const activeOpen = full.filter((v) => v.status === 'Open' || v.status === 'Partially Filled');
        setVacancies(activeOpen);
      })
      .catch(() => {
        if (alive) setVacancies([]);
      })
      .finally(() => {
        if (alive) setLoadingVacancies(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // Real-time skill/criteria job-fit scoring using @recruitflow/validation engine
  const scoredJobs = useMemo(() => scoreOpenVacancies(profile, vacancies), [profile, vacancies]);

  // Auto-select top recommended job (>= 50% fit) unless user already chose one or came with a context job
  useEffect(() => {
    if (userPickedVacancy) return;
    if (initialVacancyId && vacancies.some((v) => v.id === initialVacancyId)) {
      setSelectedVacancyId(initialVacancyId);
      return;
    }
    const top = scoredJobs[0];
    if (top && top.fit.score >= 50) {
      setSelectedVacancyId(top.vacancy.id);
    } else {
      setSelectedVacancyId('pool');
    }
  }, [scoredJobs, userPickedVacancy, initialVacancyId, vacancies]);

  const resetAll = () => {
    setStep(0);
    setDragging(false);
    setFile(null);
    setParsing(false);
    setError(null);
    setProfile(null);
    setInitialProfile(null);
    setNewSkill('');
    setNewCert('');
    setCheckingDup(false);
    setDupResult(null);
    setDupError(null);
    setDecision(initialCandidateId ? { kind: 'link', candidateId: initialCandidateId } : { kind: 'create' });
    setSelectedVacancyId(initialVacancyId || 'pool');
    setUserPickedVacancy(Boolean(initialVacancyId));
    setSource('CV Intake Upload');
    setSaving(false);
    setSavedResult(null);
  };

  const handleFile = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    const problem = cvFileProblem(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(picked);
    setParsing(true);
    try {
      const parsed = await parseCv(picked);
      const named = Boolean(parsed.firstName || parsed.lastName || parsed.email || parsed.phone);
      if (!named && !parsed.rawText?.trim()) {
        setError('No readable text was found in this CV (it may be a scanned image). Upload a searchable PDF/DOCX or enter the details manually.');
        return;
      }
      const fallbackNames = splitName(parsed, picked.name);
      const hydrated: ExtractedCv = {
        ...parsed,
        firstName: parsed.firstName?.trim() || fallbackNames.firstName,
        lastName: parsed.lastName?.trim() || (fallbackNames.lastName === '-' ? '' : fallbackNames.lastName),
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
        languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      };
      setProfile(hydrated);
      setInitialProfile(JSON.parse(JSON.stringify(hydrated)) as ExtractedCv);
      setStep(1);
    } catch (err) {
      const unreadable = err instanceof ApiError && err.code === 'FILE_INVALID';
      setError(
        unreadable
          ? errorMessage(err, 'The CV file could not be read. Upload a searchable PDF or Word (.docx) file.')
          : errorMessage(err, 'CV parsing failed. Please retry or enter details manually.'),
      );
    } finally {
      setParsing(false);
    }
  };

  const startManualEntry = () => {
    setError(null);
    const blank: ExtractedCv = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      title: '',
      currentCompany: '',
      location: '',
      experienceYears: undefined,
      skills: [],
      certifications: [],
      languages: [],
      summary: '',
    };
    setProfile(blank);
    setInitialProfile(JSON.parse(JSON.stringify(blank)) as ExtractedCv);
    setStep(1);
  };

  const updateProfile = (patch: Partial<ExtractedCv>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const addSkill = () => {
    if (!profile) return;
    const incoming = parseSkillInput(newSkill);
    if (incoming.length === 0) return;
    const current = profile.skills ?? [];
    const seen = new Set(current.map((s) => s.toLowerCase()));
    const next = [...current];
    for (const item of incoming) {
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        next.push(item);
      }
    }
    if (next.length !== current.length) {
      updateProfile({ skills: next });
    }
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    updateProfile({ skills: (profile.skills ?? []).filter((s) => s !== skill) });
  };

  const addCert = () => {
    const clean = newCert.trim();
    if (!clean || !profile) return;
    const current = profile.certifications ?? [];
    if (!current.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      updateProfile({ certifications: [...current, clean] });
    }
    setNewCert('');
  };

  const removeCert = (cert: string) => {
    if (!profile) return;
    updateProfile({ certifications: (profile.certifications ?? []).filter((c) => c !== cert) });
  };

  const refreshDomainAndSummary = () => {
    if (!profile) return;
    const detection = detectClinicalDomain(
      profile.skills ?? [],
      profile.title,
      profile.certifications,
      profile.rawText,
      profile.experienceYears ?? 0,
    );
    const next: ExtractedCv = {
      ...profile,
      clinicalDomain: detection.domain,
      subspecialties: detection.subspecialties,
      keyHighlights: detection.keyHighlights,
      aiSummaryConfidence: detection.confidence,
    };
    next.summary = generateAISummary(next);
    setProfile(next);
  };

  const nameValid = Boolean(profile?.firstName?.trim() && profile?.lastName?.trim());
  const contactValid = hasValidEmail(profile?.email) || hasValidPhone(profile?.phone);

  const proceedToMatchStep = async () => {
    if (!profile) return;
    if (!nameValid) {
      setError('Enter both First Name and Last Name before continuing.');
      return;
    }
    if (!contactValid) {
      setError('Enter a valid Email address or Phone number (at least 7 digits) so duplicate checking can run.');
      return;
    }
    setError(null);
    setStep(2);

    if (initialCandidateId) {
      setDecision({ kind: 'link', candidateId: initialCandidateId });
      setDupResult(null);
      setDupError(null);
      return;
    }

    setCheckingDup(true);
    setDupError(null);
    try {
      const res = await duplicateCheck({
        ...(hasValidEmail(profile.email) ? { email: profile.email?.trim() } : {}),
        ...(hasValidPhone(profile.phone) ? { phone: profile.phone?.trim() } : {}),
      });
      setDupResult(res);
      if (res.isDuplicate && res.matches[0]) {
        setDecision({ kind: 'link', candidateId: res.matches[0].candidateId });
      } else {
        setDecision({ kind: 'create' });
      }
    } catch (err) {
      setDupResult(null);
      setDupError(errorMessage(err, 'Duplicate check could not finish now; the server will re-check on save.'));
      setDecision({ kind: 'create' });
    } finally {
      setCheckingDup(false);
    }
  };

  const confirmAndSave = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveValidatedCvIntake({
        file,
        cv: profile,
        decision,
        vacancyId: selectedVacancyId === 'pool' ? null : selectedVacancyId,
        source,
        duplicateCheck: dupResult,
      });
      setSavedResult(result);
      setStep(3);
      onCompleted?.(result);
    } catch (err) {
      setError(errorMessage(err, 'Could not save candidate intake. Please review and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const selectedJob = scoredJobs.find((j) => j.vacancy.id === selectedVacancyId) ?? null;

  const primaryAction = (() => {
    if (step === 0) {
      return (
        <ButtonV2
          kind="primary"
          icon={<Upload />}
          loading={parsing}
          onClick={() => fileInputRef.current?.click()}
        >
          {parsing ? 'Parsing CV…' : 'Select CV file'}
        </ButtonV2>
      );
    }
    if (step === 1) {
      return (
        <ButtonV2
          kind="primary"
          icon={<ArrowRight />}
          onClick={() => void proceedToMatchStep()}
        >
          Validate &amp; View Job Fit
        </ButtonV2>
      );
    }
    if (step === 2) {
      return (
        <ButtonV2
          kind="primary"
          icon={<CheckCircle2 />}
          loading={saving}
          disabled={checkingDup}
          onClick={() => void confirmAndSave()}
        >
          {selectedJob ? `Confirm & Apply to ${selectedJob.title}` : 'Confirm & Save to CV Bank'}
        </ButtonV2>
      );
    }
    return (
      <ButtonV2 kind="primary" onClick={() => { resetAll(); onClose(); }}>
        Done
      </ButtonV2>
    );
  })();

  const secondaryAction = (() => {
    if (step === 0) {
      return <ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>;
    }
    if (step === 1) {
      return (
        <ButtonV2 kind="secondary" icon={<ArrowLeft />} onClick={() => { setError(null); setStep(0); }}>
          Upload another file
        </ButtonV2>
      );
    }
    if (step === 2) {
      return (
        <ButtonV2 kind="secondary" icon={<ArrowLeft />} disabled={saving} onClick={() => { setError(null); setStep(1); }}>
          Back to Edit
        </ButtonV2>
      );
    }
    return (
      <ButtonV2 kind="secondary" icon={<Upload />} onClick={resetAll}>
        Upload another CV
      </ButtonV2>
    );
  })();

  if (!open) return null;

  return (
    <DrawerV2
      open={open}
      onClose={() => {
        resetAll();
        onClose();
      }}
      kicker="CV Intake & Job Fit Engine"
      title={
        step === 0
          ? 'Upload & Parse Candidate CV'
          : step === 1
            ? 'Validate & Edit Detected Data'
            : step === 2
              ? 'Duplicate Check & Open-Job Recommendations'
              : 'Candidate Saved & Assigned'
      }
      subtitle="Extract candidate details, validate fields, check duplicates, and match against open jobs by skills."
      confirmClose={() => (parsing || saving ? false : true)}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
    >
      <div className="rf2-intake">
        {/* 4-Stage Stepper */}
        <ol className="rf2-intake__steps" aria-label="CV intake progress">
          {STEPS.map((label, idx) => {
            const state = idx < step ? 'done' : idx === step ? 'active' : 'pending';
            return (
              <li key={label} className="rf2-intake__step" data-state={state} aria-current={idx === step ? 'step' : undefined}>
                <span className="rf2-intake__step-num">{idx < step ? '✓' : idx + 1}</span>
                <span className="rf2-intake__step-label">{label}</span>
              </li>
            );
          })}
        </ol>

        {error ? (
          <div className="rf2-intake__alert" data-tone="danger" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* ── STEP 0: UPLOAD CV ── */}
        {step === 0 ? (
          <>
            <div
              className="rf2-intake__drop"
              data-dragging={dragging ? 'true' : 'false'}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <span className="rf2-intake__drop-icon" aria-hidden="true">
                <Upload />
              </span>
              <h3 className="rf2-intake__drop-title">
                {parsing ? 'Extracting skills, experience & contact details…' : 'Drop a candidate CV here or browse'}
              </h3>
              <p className="rf2-intake__drop-sub">
                Supports searchable PDF (.pdf) and Word (.doc, .docx) up to 10 MB. You will review all detected fields and recommended open jobs before saving.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="rf2-sr-only"
                aria-label="Choose CV file for intake engine"
                accept=".pdf,.doc,.docx"
                disabled={parsing}
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  e.target.value = '';
                  void handleFile(picked);
                }}
              />
              <div className="rf2-intake__drop-actions">
                <ButtonV2 kind="primary" size="sm" icon={<Upload />} loading={parsing} onClick={() => fileInputRef.current?.click()}>
                  {parsing ? 'Parsing CV…' : 'Browse CV file'}
                </ButtonV2>
                <ButtonV2 kind="secondary" size="sm" disabled={parsing} onClick={startManualEntry}>
                  Enter details manually
                </ButtonV2>
              </div>
            </div>

            <div className="rf2-intake__engine-notes">
              <div className="rf2-intake__engine-note">
                <strong>1. Detect &amp; Validate</strong>
                <span>Auto-parses name, contact, title, experience, domain, and skills for your review.</span>
              </div>
              <div className="rf2-intake__engine-note">
                <strong>2. Duplicate Guard</strong>
                <span>Verifies email &amp; phone against the bank before creating any record.</span>
              </div>
              <div className="rf2-intake__engine-note">
                <strong>3. Skill Job Fit</strong>
                <span>Ranks all active open jobs by matched skills and experience so you can assign immediately.</span>
              </div>
            </div>
          </>
        ) : null}

        {/* ── STEP 1: VALIDATE & EDIT DETECTED DATA ── */}
        {step === 1 && profile ? (
          <>
            <div className="rf2-intake__meta-bar">
              <div className="rf2-intake__file-info">
                <FileText aria-hidden="true" />
                <span>{file?.name || 'Manual candidate intake'}</span>
                {profile.parsingQuality ? (
                  <StatusChip
                    tone={profile.parsingQuality === 'high' ? 'success' : profile.parsingQuality === 'medium' ? 'info' : 'warning'}
                    label={`${profile.parsingQuality} quality${profile.parserSource ? ` · ${profile.parserSource === 'affinda' ? 'ATS engine' : 'Local extractor'}` : ''}`}
                  />
                ) : null}
              </div>
              {initialProfile ? (
                <ButtonV2
                  kind="secondary"
                  size="sm"
                  icon={<RotateCcw />}
                  onClick={() => {
                    setProfile(JSON.parse(JSON.stringify(initialProfile)) as ExtractedCv);
                    setError(null);
                  }}
                >
                  Reset to parsed
                </ButtonV2>
              ) : null}
            </div>

            {/* Live validation checklist */}
            <ul className="rf2-intake__checklist" aria-label="Validation checks">
              <li className="rf2-intake__check-item" data-ok={nameValid ? 'true' : 'false'}>
                {nameValid ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                <span>{nameValid ? 'Name validated' : 'First & Last Name required'}</span>
              </li>
              <li className="rf2-intake__check-item" data-ok={contactValid ? 'true' : 'false'}>
                {contactValid ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                <span>{contactValid ? 'Contact ready for duplicate check' : 'Email or Phone required'}</span>
              </li>
              <li className="rf2-intake__check-item" data-ok={(profile.skills?.length ?? 0) > 0 ? 'true' : 'false'}>
                <Sparkles aria-hidden="true" />
                <span>{`${profile.skills?.length ?? 0} skill${(profile.skills?.length ?? 0) === 1 ? '' : 's'} detected`}</span>
              </li>
            </ul>

            <section className="rf2-intake__section" aria-label="Detected identity and contact">
              <div className="rf2-intake__section-head">
                <h3 className="rf2-intake__section-title">Candidate Identity &amp; Profile</h3>
              </div>
              <div className="rf2-intake__grid">
                <InputV2
                  label="First name"
                  required
                  value={profile.firstName ?? ''}
                  onChange={(e) => updateProfile({ firstName: e.target.value })}
                  placeholder="First name"
                />
                <InputV2
                  label="Last name"
                  required
                  value={profile.lastName ?? ''}
                  onChange={(e) => updateProfile({ lastName: e.target.value })}
                  placeholder="Last name"
                />
                <InputV2
                  label="Email"
                  type="email"
                  value={profile.email ?? ''}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  placeholder="candidate@example.com"
                />
                <InputV2
                  label="Phone"
                  type="tel"
                  value={profile.phone ?? ''}
                  onChange={(e) => updateProfile({ phone: e.target.value })}
                  placeholder="+971 50 123 4567"
                />
                <InputV2
                  label="Current title"
                  value={profile.title ?? ''}
                  onChange={(e) => updateProfile({ title: e.target.value })}
                  placeholder="e.g. Senior ICU Nurse"
                />
                <InputV2
                  label="Current company"
                  value={profile.currentCompany ?? ''}
                  onChange={(e) => updateProfile({ currentCompany: e.target.value })}
                  placeholder="Hospital or organization"
                />
                <InputV2
                  label="Experience (years)"
                  type="number"
                  min={0}
                  max={60}
                  value={profile.experienceYears ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    updateProfile({ experienceYears: raw === '' ? undefined : Math.max(0, Number(raw)) });
                  }}
                  placeholder="e.g. 5"
                />
                <InputV2
                  label="Location"
                  value={profile.location ?? ''}
                  onChange={(e) => updateProfile({ location: e.target.value })}
                  placeholder="e.g. Dubai, Cairo, Riyadh"
                />
              </div>
            </section>

            {/* Interactive Skills Editor */}
            <section className="rf2-intake__section" aria-label="Detected skills and credentials">
              <div className="rf2-intake__section-head">
                <h3 className="rf2-intake__section-title">
                  <Sparkles aria-hidden="true" />
                  <span>Detected Skills (drives open-job recommendations)</span>
                </h3>
                {profile.clinicalDomain ? (
                  <StatusChip tone="info" label={profile.clinicalDomain} />
                ) : null}
              </div>

              <div className="rf2-skills-box__well" aria-label="Candidate skills list">
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill) => {
                    const label = formatSkillLabel(skill);
                    return (
                      <span key={skill} className="rf2-intake__tag">
                        <span>{label}</span>
                        <button
                          type="button"
                          className="rf2-intake__tag-remove"
                          aria-label={`Remove skill ${label}`}
                          onClick={() => removeSkill(skill)}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <p className="rf2-skills-box__empty">
                    No skills detected yet. Add key skills below to improve open-job matching.
                  </p>
                )}
              </div>

              <div className="rf2-intake__tag-add">
                <InputV2
                  label="Add skill"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add skill (e.g. ICU, ACLS, PACS, React)"
                />
                <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={addSkill}>
                  Add
                </ButtonV2>
              </div>

              {/* Certifications */}
              <div className="rf2-intake__tag-add">
                <InputV2
                  label="Add certification or license"
                  value={newCert}
                  onChange={(e) => setNewCert(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCert();
                    }
                  }}
                  placeholder="e.g. DHA License, BLS, ACLS, SCFHS"
                />
                <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={addCert}>
                  Add
                </ButtonV2>
              </div>
              {profile.certifications && profile.certifications.length > 0 ? (
                <div className="rf2-intake__tags" aria-label="Candidate certifications list">
                  {profile.certifications.map((cert) => (
                    <span key={cert} className="rf2-intake__tag">
                      <span>{cert}</span>
                      <button
                        type="button"
                        className="rf2-intake__tag-remove"
                        aria-label={`Remove certification ${cert}`}
                        onClick={() => removeCert(cert)}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="rf2-intake__section-head">
                <span className="rf2-intake__rec-reason">Summary &amp; clinical domain</span>
                <ButtonV2 kind="secondary" size="sm" icon={<Sparkles />} onClick={refreshDomainAndSummary}>
                  Refresh domain &amp; summary
                </ButtonV2>
              </div>
              <TextareaV2
                label="Candidate summary"
                rows={3}
                value={profile.summary ?? ''}
                onChange={(e) => updateProfile({ summary: e.target.value })}
                placeholder="Clinical or professional summary extracted from the CV"
              />
            </section>

            {/* Live Open-Job Fit Preview right inside Step 2 */}
            <section className="rf2-intake__section" aria-label="Live open-job fit preview">
              <div className="rf2-intake__section-head">
                <h3 className="rf2-intake__section-title">
                  <Briefcase aria-hidden="true" />
                  <span>Live Open-Job Fit Preview ({scoredJobs.length} open jobs evaluated)</span>
                </h3>
              </div>
              {loadingVacancies ? (
                <p className="rf2-intake__rec-reason">Loading active open jobs…</p>
              ) : scoredJobs.length === 0 ? (
                <p className="rf2-intake__rec-reason">No active open jobs in your scope right now. You can still save the candidate to the CV Bank.</p>
              ) : (
                <ul className="rf2-intake__recs">
                  {scoredJobs.slice(0, 3).map((item, idx) => (
                    <li key={item.vacancy.id} className="rf2-intake__rec">
                      <div className="rf2-intake__rec-top">
                        <div>
                          <p className="rf2-intake__rec-title">{item.title}</p>
                          <p className="rf2-intake__rec-meta">
                            {[item.vacancy.vacancyCode, item.vacancy.department, item.vacancy.branch?.name].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="rf2-intake__rec-badges">
                          {idx === 0 && item.fit.score >= 50 ? <StatusChip tone="success" label="Best fit" /> : null}
                          <span className="rf2-intake__score" data-level={item.fit.matchLevel}>
                            {Math.round(item.fit.score)}% Fit
                          </span>
                        </div>
                      </div>
                      {item.fit.breakdown.skills.matched.length > 0 ? (
                        <div className="rf2-intake__kw-row">
                          {item.fit.breakdown.skills.matched.slice(0, 5).map((kw) => (
                            <span key={kw} className="rf2-intake__kw" data-kind="match">✓ {kw}</span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        {/* ── STEP 2: DUPLICATE RESOLUTION & OPEN-JOB RECOMMENDATIONS ── */}
        {step === 2 && profile ? (
          <>
            {/* Duplicate Verification Panel */}
            <section className="rf2-intake__section" aria-label="Duplicate check results">
              <div className="rf2-intake__section-head">
                <h3 className="rf2-intake__section-title">
                  <Link2 aria-hidden="true" />
                  <span>Identity &amp; Duplicate Verification</span>
                </h3>
                {checkingDup ? (
                  <StatusChip tone="neutral" label="Checking…" />
                ) : dupResult?.isDuplicate ? (
                  <StatusChip tone="warning" label="Existing match found" />
                ) : (
                  <StatusChip tone="success" label="Verified unique" />
                )}
              </div>

              {checkingDup ? (
                <p className="rf2-intake__rec-reason">Checking email and phone against existing bank records…</p>
              ) : dupError ? (
                <div className="rf2-intake__alert" data-tone="warning">
                  <TriangleAlert aria-hidden="true" />
                  <span>{dupError}</span>
                </div>
              ) : dupResult?.isDuplicate && dupResult.matches.length > 0 ? (
                <>
                  <div className="rf2-intake__alert" data-tone="warning">
                    <TriangleAlert aria-hidden="true" />
                    <span>
                      A candidate with matching contact details is already in the bank. Link this CV to enrich their empty fields and merge skills without creating a duplicate identity.
                    </span>
                  </div>
                  <div className="rf2-intake__dup-opts" role="radiogroup" aria-label="Duplicate resolution">
                    {dupResult.matches.map((m) => {
                      const selected = decision.kind === 'link' && decision.candidateId === m.candidateId;
                      return (
                        <label key={m.candidateId} className="rf2-intake__dup-opt" data-selected={selected ? 'true' : 'false'}>
                          <input
                            type="radio"
                            name="intake-dup"
                            checked={selected}
                            onChange={() => setDecision({ kind: 'link', candidateId: m.candidateId })}
                          />
                          <div>
                            <p className="rf2-intake__rec-title">
                              Link &amp; enrich <strong>{m.name}</strong> {m.candidateCode ? `(${m.candidateCode})` : ''}
                            </p>
                            <p className="rf2-intake__rec-meta">
                              Matched by: {m.matchedBy.map((k) => `${k === 'email' ? 'same email' : 'same phone'} (${k === 'email' ? dupResult.normalized.email : dupResult.normalized.phone})`).join(' & ')}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rf2-intake__alert" data-tone="success">
                  <CircleCheck aria-hidden="true" />
                  <span>
                    No existing candidate matched {profile.email || profile.phone}. A new candidate record will be created for{' '}
                    <strong>{profile.firstName} {profile.lastName}</strong>.
                  </span>
                </div>
              )}
            </section>

            {/* Open-Job Recommendations & Assignment */}
            <section className="rf2-intake__section" aria-label="Recommended open jobs">
              <div className="rf2-intake__section-head">
                <h3 className="rf2-intake__section-title">
                  <Briefcase aria-hidden="true" />
                  <span>Recommended Open Jobs (ranked by skills fit)</span>
                </h3>
                <span className="rf2-intake__rec-meta">{scoredJobs.length} open job{scoredJobs.length === 1 ? '' : 's'}</span>
              </div>

              <ul className="rf2-intake__recs" role="radiogroup" aria-label="Choose open job or CV bank">
                {scoredJobs.map((item, idx) => {
                  const selected = selectedVacancyId === item.vacancy.id;
                  const matched = item.fit.breakdown.skills.matched;
                  const missing = item.fit.breakdown.skills.missing;
                  const exp = item.fit.breakdown.experience;
                  return (
                    <li
                      key={item.vacancy.id}
                      className="rf2-intake__rec"
                      data-selected={selected ? 'true' : 'false'}
                      onClick={() => {
                        setSelectedVacancyId(item.vacancy.id);
                        setUserPickedVacancy(true);
                      }}
                    >
                      <div className="rf2-intake__rec-top">
                        <label className="rf2-intake__rec-pick">
                          <input
                            type="radio"
                            name="intake-target-job"
                            checked={selected}
                            onChange={() => {
                              setSelectedVacancyId(item.vacancy.id);
                              setUserPickedVacancy(true);
                            }}
                          />
                          <div>
                            <p className="rf2-intake__rec-title">{item.title}</p>
                            <p className="rf2-intake__rec-meta">
                              {[item.vacancy.vacancyCode, item.vacancy.department, item.vacancy.branch?.name].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </label>
                        <div className="rf2-intake__rec-badges">
                          {idx === 0 && item.fit.score >= 50 ? <StatusChip tone="success" label="Recommended" /> : null}
                          <span className="rf2-intake__score" data-level={item.fit.matchLevel}>
                            {Math.round(item.fit.score)}% Fit
                          </span>
                        </div>
                      </div>

                      {matched.length > 0 || missing.length > 0 ? (
                        <div className="rf2-intake__kw-row">
                          {matched.slice(0, 6).map((kw) => (
                            <span key={`m-${kw}`} className="rf2-intake__kw" data-kind="match">✓ {kw}</span>
                          ))}
                          {missing.slice(0, 4).map((kw) => (
                            <span key={`x-${kw}`} className="rf2-intake__kw" data-kind="missing">− {kw}</span>
                          ))}
                        </div>
                      ) : null}

                      <p className="rf2-intake__rec-reason">
                        {exp.required > 0
                          ? `${exp.met ? 'Experience fits' : 'Experience gap'}: ${exp.actual} yrs vs ${exp.required}+ yrs required · ${item.fit.summaryText}`
                          : item.fit.summaryText}
                      </p>
                    </li>
                  );
                })}

                {/* Save to CV Bank only option */}
                <li
                  className="rf2-intake__rec"
                  data-selected={selectedVacancyId === 'pool' ? 'true' : 'false'}
                  onClick={() => {
                    setSelectedVacancyId('pool');
                    setUserPickedVacancy(true);
                  }}
                >
                  <div className="rf2-intake__rec-top">
                    <label className="rf2-intake__rec-pick">
                      <input
                        type="radio"
                        name="intake-target-job"
                        checked={selectedVacancyId === 'pool'}
                        onChange={() => {
                          setSelectedVacancyId('pool');
                          setUserPickedVacancy(true);
                        }}
                      />
                      <div>
                        <p className="rf2-intake__rec-title">Save to CV Bank only (no open job yet)</p>
                        <p className="rf2-intake__rec-meta">Store the validated profile and CV file in the talent bank for future matching.</p>
                      </div>
                    </label>
                  </div>
                </li>
              </ul>

              <SelectV2
                label="Candidate source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </SelectV2>
            </section>
          </>
        ) : null}

        {/* ── STEP 3: CONFIRMED ── */}
        {step === 3 && savedResult && profile ? (
          <div className="rf2-intake__done" role="status">
            <span className="rf2-intake__done-icon" aria-hidden="true">
              <CheckCircle2 />
            </span>
            <h3 className="rf2-intake__done-title">
              {savedResult.linked ? 'Candidate linked & CV stored' : 'Candidate created & CV stored'}
            </h3>
            <p className="rf2-intake__done-sub">
              <strong>{profile.firstName} {profile.lastName}</strong>
              {savedResult.candidateCode ? ` (${savedResult.candidateCode})` : ''} has been saved with validated skills
              {selectedJob ? ` and ${savedResult.alreadyOnJob ? 'was already on' : 'applied to'} ${selectedJob.title}.` : ' in the CV Bank.'}
            </p>

            <dl className="rf2-intake__done-summary">
              <div>
                <dt>Identity status</dt>
                <dd>{savedResult.linked ? 'Linked to existing profile' : 'New candidate created'}</dd>
              </div>
              <div>
                <dt>CV file</dt>
                <dd>{savedResult.documentId ? savedResult.fileName : 'Manual entry (no file)'}</dd>
              </div>
              <div>
                <dt>Assigned open job</dt>
                <dd>{selectedJob ? `${selectedJob.title} (${Math.round(selectedJob.fit.score)}% Fit)` : 'CV Bank only'}</dd>
              </div>
              <div>
                <dt>Skills saved</dt>
                <dd>{profile.skills?.length ? `${profile.skills.length} skills` : 'None added'}</dd>
              </div>
            </dl>

            {savedResult.linkResult?.filled.length ? (
              <div className="rf2-intake__alert" data-tone="info">
                <CircleCheck aria-hidden="true" />
                <span>
                  Enriched empty fields on existing profile: {savedResult.linkResult.filled.map((f) => FIELD_LABEL[f] ?? f).join(', ')}.
                </span>
              </div>
            ) : null}

            {savedResult.linkResult?.conflicts.length ? (
              <div className="rf2-intake__alert" data-tone="warning">
                <TriangleAlert aria-hidden="true" />
                <span>
                  Existing bank values preserved for: {savedResult.linkResult.conflicts.map((c) => FIELD_LABEL[c.field] ?? c.field).join(', ')}.
                </span>
              </div>
            ) : null}

            <div className="rf2-intake__done-links">
              <Link
                className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                to={`/candidates/${encodeURIComponent(savedResult.candidateId)}`}
                onClick={onClose}
              >
                <span>Open Candidate Profile</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
              {savedResult.applicationId ? (
                <Link
                  className="rf2-btn rf2-btn--primary rf2-btn--sm"
                  to={`/applications/${encodeURIComponent(savedResult.applicationId)}`}
                  onClick={onClose}
                >
                  <span>Open Application File</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </DrawerV2>
  );
}
