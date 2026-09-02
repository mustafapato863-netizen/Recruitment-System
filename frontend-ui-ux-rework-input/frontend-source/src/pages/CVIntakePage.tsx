import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportJobSummary, PaginatedResult } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { PipelineStepper } from '../components/PipelineStepper';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TableSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { Textarea } from '../components/ui/Textarea';
import { parseResumeFile, type ExtractedCandidate } from '../utils/resumeParser';
import './PageEnhancementsV2.css';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const INTAKE_STEPS = ['Upload', 'Validate & Edit', 'Resolve', 'Confirm'];

const importJobColumns: ResponsiveDataColumn<ImportJobSummary>[] = [
  {
    key: 'file',
    header: 'File',
    priority: 'primary',
    render: (job) => (
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rf-action-soft text-rf-action">
          <Icon name="file-text" size={14} />
        </span>
        <span className="min-w-0 truncate font-bold text-rf-ink">{job.fileName}</span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (job) => <StatusBadge status={job.status} />,
  },
  {
    key: 'rows',
    header: 'Total rows',
    priority: 'secondary',
    render: (job) => <span className="font-bold text-rf-ink">{job.totalRows}</span>,
  },
  {
    key: 'valid',
    header: 'Valid',
    priority: 'tertiary',
    render: (job) => <span className="font-bold text-rf-success">{job.validRows}</span>,
  },
  {
    key: 'issues',
    header: 'Issues',
    priority: 'secondary',
    render: (job) => (
      <Badge variant={job.invalidRows + job.duplicateRows > 0 ? 'warning' : 'neutral'}>
        {job.invalidRows + job.duplicateRows}
      </Badge>
    ),
  },
  {
    key: 'created',
    header: 'Created',
    priority: 'tertiary',
    render: (job) => <span className="font-medium text-rf-ink-muted">{new Date(job.createdAt).toLocaleDateString()}</span>,
  },
];

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'An unexpected error occurred.';
}

export function CVIntakePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [profile, setProfile] = useState<ExtractedCandidate | null>(null);
  const [initialProfile, setInitialProfile] = useState<ExtractedCandidate | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newCert, setNewCert] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [parsingFile, setParsingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      const response = await getApi<PaginatedResult<ImportJobSummary>>('/candidates/import/jobs?page=1&pageSize=50');
      setJobs(response.data);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setProfile(null);
    setInitialProfile(null);
    setUploadedFileName(null);

    const fileNameLower = file.name.toLowerCase();
    const isWordOrPdf = ALLOWED_EXTENSIONS.some((extension) => fileNameLower.endsWith(extension)) || ALLOWED_MIMES.includes(file.type);

    if (!isWordOrPdf) {
      setError('Invalid file format. Please upload only Word (.doc, .docx) or PDF (.pdf) documents.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('The document must be 10 MB or smaller.');
      return;
    }

    setParsingFile(true);
    try {
      const extracted = await parseResumeFile(file);
      setUploadedFileName(file.name);
      setProfile({ ...extracted });
      setInitialProfile({ ...extracted });
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setParsingFile(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || !profile) return;
    const currentSkills = profile.skills || [];
    if (!currentSkills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setProfile({ ...profile, skills: [...currentSkills, trimmed] });
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter(s => s !== skillToRemove),
    });
  };

  const handleAddLanguage = () => {
    const trimmed = newLanguage.trim();
    if (!trimmed || !profile) return;
    const currentLangs = profile.languages || [];
    if (!currentLangs.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      setProfile({ ...profile, languages: [...currentLangs, trimmed] });
    }
    setNewLanguage('');
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      languages: (profile.languages || []).filter(l => l !== langToRemove),
    });
  };

  const handleAddCert = () => {
    const trimmed = newCert.trim();
    if (!trimmed || !profile) return;
    const currentCerts = profile.certifications || [];
    if (!currentCerts.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setProfile({ ...profile, certifications: [...currentCerts, trimmed] });
    }
    setNewCert('');
  };

  const handleRemoveCert = (certToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      certifications: (profile.certifications || []).filter(c => c !== certToRemove),
    });
  };

  const resetToParsed = () => {
    if (initialProfile) {
      setProfile({ ...initialProfile });
    }
  };

  const clearUpload = () => {
    setProfile(null);
    setInitialProfile(null);
    setUploadedFileName(null);
    setError(null);
  };

  const startImport = async () => {
    if (!profile || !uploadedFileName) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      fileName: uploadedFileName,
      rows: [
        {
          firstName: profile.firstName?.trim() || null,
          lastName: profile.lastName?.trim() || null,
          email: profile.email?.trim().toLowerCase() || null,
          phone: profile.phone?.trim() || null,
          currentTitle: profile.title?.trim() || null,
          currentCompany: profile.currentCompany?.trim() || null,
          skills: profile.skills || [],
          experienceYears: profile.experienceYears ? Number(profile.experienceYears) : null,
          location: profile.location?.trim() || null,
          education: profile.education?.trim() || null,
          certifications: profile.certifications || [],
          languages: profile.languages || [],
          summary: profile.summary?.trim() || null,
        },
      ],
    };

    try {
      const response = await postApi<{ jobId: string }>('/candidates/import/upload', payload);
      void navigate(`/cv-intake/${response.jobId}`);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
      setSubmitting(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Talent & Intake"
      title="Candidate & CV Intake"
      description="Upload candidate CVs and resumes in Word (.doc, .docx) or PDF (.pdf) format to parse, review full extracted profile data, and confirm them into the talent database."
    >
      <PipelineStepper steps={INTAKE_STEPS} currentStep={profile ? 1 : 0} />

      {error && <Alert tone="danger" title="Intake attention">{error}</Alert>}

      {!profile ? (
        /* ─── UPLOAD VIEW ─── */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rf-panel lg:col-span-2 overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
            <SectionHeader
              title="Candidate resume and CV intake"
              description="Choose one Word document or PDF. RecruitFlow extracts the complete candidate profile for your review."
              className="border-b border-rf-border-subtle p-5"
              actions={<Badge variant="success">Word and PDF</Badge>}
            />

            <div className="p-5 sm:p-6">
              <input
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Candidate CV document"
                className="sr-only"
                disabled={parsingFile}
                id="cv-intake-file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  void handleFile(file);
                }}
                ref={inputRef}
                type="file"
              />
              <button
                aria-describedby="cv-intake-upload-hint"
                className={`rf-upload-dropzone group${isDragging ? ' is-dragging' : ''}`}
                disabled={parsingFile}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) setIsDragging(false);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void handleFile(event.dataTransfer.files?.[0]);
                }}
                type="button"
              >
                <span className="rf-upload-dropzone__icon" aria-hidden="true">
                  {parsingFile ? <Spinner size={28} /> : <Icon name="upload" size={28} />}
                </span>
                <strong className="text-base font-bold text-rf-ink mt-2">
                  {parsingFile
                    ? 'Extracting comprehensive candidate profile...'
                    : 'Choose a Word or PDF CV to upload'}
                </strong>
                <span id="cv-intake-upload-hint" className="rf-upload-dropzone__hint text-xs text-rf-ink-muted mt-1 max-w-md text-center">
                  {parsingFile
                    ? 'Extracting full name, contact, job title, company, experience years, skills, education, languages, and summary'
                    : 'Drag and drop your document here or browse. Supports PDF, DOC, DOCX up to 10 MB.'}
                </span>
              </button>
            </div>
          </section>

          <aside className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
            <SectionHeader
              title="Intake specifications"
              description="Accepted file types and extraction capabilities."
              className="border-b border-rf-border-subtle p-5"
              actions={<Badge variant="info">Specs</Badge>}
            />
            <div className="grid gap-3.5 p-5">
              <div className="rf-file-spec flex items-center gap-3 p-3 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle">
                <Badge variant="danger">PDF</Badge>
                <div>
                  <strong className="block text-xs font-bold text-rf-ink">Adobe PDF (.pdf)</strong>
                  <span className="text-[11px] text-rf-ink-muted">Standard resumes & CV portfolios</span>
                </div>
              </div>
              <div className="rf-file-spec flex items-center gap-3 p-3 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle">
                <Badge variant="info">DOC</Badge>
                <div>
                  <strong className="block text-xs font-bold text-rf-ink">Microsoft Word (.docx, .doc)</strong>
                  <span className="text-[11px] text-rf-ink-muted">Editable Word resume formats</span>
                </div>
              </div>
              <div className="rounded-xl border border-rf-action-soft bg-rf-action-soft/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-rf-action mb-1.5">
                  <Icon name="sparkles" size={14} className="text-rf-action" />
                  Full Data Extraction
                </div>
                <p className="text-[11.5px] leading-relaxed text-rf-ink-muted">
                  RecruitFlow automatically parses contact info, role title, employer, experience, skills, education, and bio. You can freely edit any field before confirming.
                </p>
              </div>
              <Alert tone="warning" title="File limits">
                Files must be under 10 MB. Scanned images without text layers should be provided in readable PDF format.
              </Alert>
            </div>
          </aside>
        </div>
      ) : (
        /* ─── RICH CANDIDATE PROFILE REVIEW & EDIT CARD ─── */
        <section className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-sm animate-in fade-in duration-300">
          {/* Header Bar */}
          <div className="border-b border-rf-border-subtle bg-rf-surface-subtle p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rf-action text-white font-extrabold text-lg shadow-sm">
                {`${(profile.firstName || 'C')[0]}${(profile.lastName || 'P')[0]}`.toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-rf-ink">
                    {`${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Candidate Profile'}
                  </h2>
                  {profile.title && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rf-action-soft text-rf-action">
                      {profile.title}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-rf-success-soft text-rf-success">
                    <Icon name="check-circle" size={11} className="mr-1" />
                    Parsed from {uploadedFileName}
                  </span>
                </div>
                <p className="text-xs text-rf-ink-muted mt-0.5">
                  Review and edit the extracted details below before proceeding to the validation stage.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetToParsed} type="button" title="Reset fields to original parsed values">
                <Icon name="refresh-cw" size={13} />
                Reset
              </Button>
              <Button variant="secondary" size="sm" onClick={clearUpload} type="button">
                <Icon name="upload" size={13} />
                Upload another
              </Button>
              <Button
                variant="primary"
                size="md"
                className="sgh-btn-gradient"
                loading={submitting}
                loadingLabel="Processing batch"
                onClick={() => void startImport()}
                type="button"
              >
                <Icon name="check-circle" size={15} />
                Validate & Process to Intake
              </Button>
            </div>
          </div>

          <div className="p-5 sm:p-6 grid gap-6">
            {/* 1. Personal & Contact Details */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-6 items-center justify-center rounded-md bg-rf-action-soft text-rf-action">
                  <Icon name="user" size={13} />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink">
                  Personal & Contact Information
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 bg-rf-surface-subtle p-4 rounded-xl border border-rf-border-subtle">
                <FormField id="cand-first-name" label="First Name" required>
                  <Input
                    id="cand-first-name"
                    value={profile.firstName || ''}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    placeholder="First Name"
                    className="bg-rf-surface"
                  />
                </FormField>

                <FormField id="cand-last-name" label="Last Name" required>
                  <Input
                    id="cand-last-name"
                    value={profile.lastName || ''}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    placeholder="Last Name"
                    className="bg-rf-surface"
                  />
                </FormField>

                <FormField id="cand-email" label="Email Address" required>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="mail" size={15} />
                    <Input
                      id="cand-email"
                      type="email"
                      value={profile.email || ''}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="email@example.com"
                      className="pl-9 bg-rf-surface"
                    />
                  </div>
                </FormField>

                <FormField id="cand-phone" label="Phone Number">
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="phone" size={15} />
                    <Input
                      id="cand-phone"
                      value={profile.phone || ''}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+20 100 000 0000"
                      className="pl-9 bg-rf-surface"
                    />
                  </div>
                </FormField>

                <FormField id="cand-location" label="Location / City">
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="building" size={15} />
                    <Input
                      id="cand-location"
                      value={profile.location || ''}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      placeholder="Cairo, Egypt"
                      className="pl-9 bg-rf-surface"
                    />
                  </div>
                </FormField>

                <FormField id="cand-education" label="Highest Education">
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="document" size={15} />
                    <Input
                      id="cand-education"
                      value={profile.education || ''}
                      onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                      placeholder="B.Sc. in Computer Science"
                      className="pl-9 bg-rf-surface"
                    />
                  </div>
                </FormField>
              </div>
            </div>

            {/* 2. Professional Background */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-6 items-center justify-center rounded-md bg-rf-action-soft text-rf-action">
                  <Icon name="briefcase" size={13} />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink">
                  Professional Background & Experience
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-rf-surface-subtle p-4 rounded-xl border border-rf-border-subtle">
                <FormField id="cand-title" label="Current / Target Job Title" required>
                  <Input
                    id="cand-title"
                    value={profile.title || ''}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    placeholder="e.g. Data Analyst"
                    className="bg-rf-surface"
                  />
                </FormField>

                <FormField id="cand-company" label="Current / Recent Employer">
                  <Input
                    id="cand-company"
                    value={profile.currentCompany || ''}
                    onChange={(e) => setProfile({ ...profile, currentCompany: e.target.value })}
                    placeholder="e.g. Saudi German Health"
                    className="bg-rf-surface"
                  />
                </FormField>

                <FormField id="cand-experience" label="Years of Experience">
                  <Input
                    id="cand-experience"
                    type="number"
                    min={0}
                    max={50}
                    value={profile.experienceYears ?? ''}
                    onChange={(e) => setProfile({ ...profile, experienceYears: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                    placeholder="e.g. 5"
                    className="bg-rf-surface"
                  />
                </FormField>
              </div>
            </div>

            {/* 3. Skills & Competencies (Interactive Tag Chips) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-rf-warning-soft text-rf-warning">
                    <Icon name="sparkles" size={13} />
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink">
                    Skills & Key Competencies ({profile.skills?.length || 0})
                  </h3>
                </div>
                <span className="text-[11px] text-rf-ink-muted">Click (×) to remove or type to add</span>
              </div>

              <div className="bg-rf-surface-subtle p-4 rounded-xl border border-rf-border-subtle">
                {/* Chip pills */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 min-h-8">
                  {(profile.skills && profile.skills.length > 0) ? (
                    profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rf-surface border border-rf-border text-rf-ink shadow-2xs group hover:border-rf-danger hover:text-rf-danger transition-colors"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="size-4 inline-flex items-center justify-center rounded-full text-rf-ink-muted hover:text-rf-danger transition-colors"
                          aria-label={`Remove skill ${skill}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-rf-ink-muted italic">No skills added yet. Type below to add.</span>
                  )}
                </div>

                {/* Inline add skill */}
                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Add a new skill (e.g. Python, SQL)..."
                    className="h-9 text-xs bg-rf-surface"
                  />
                  <Button variant="secondary" size="sm" onClick={handleAddSkill} type="button">
                    <Icon name="plus" size={13} />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* 4. Languages & Certifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Languages */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-rf-info-soft text-rf-info">
                    <Icon name="chat" size={13} />
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink">
                    Languages ({profile.languages?.length || 0})
                  </h3>
                </div>
                <div className="bg-rf-surface-subtle p-3.5 rounded-xl border border-rf-border-subtle">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5 min-h-7">
                    {(profile.languages || []).map((lang) => (
                      <span key={lang} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-rf-surface border border-rf-border text-rf-ink shadow-2xs">
                        {lang}
                        <button type="button" onClick={() => handleRemoveLanguage(lang)} className="text-rf-ink-muted hover:text-rf-danger">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLanguage();
                        }
                      }}
                      placeholder="Add language..."
                      className="h-8 text-xs bg-rf-surface"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddLanguage} type="button">Add</Button>
                  </div>
                </div>
              </div>

              {/* Certifications */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-rf-action-soft text-rf-action">
                    <Icon name="star" size={13} />
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink">
                    Certifications ({profile.certifications?.length || 0})
                  </h3>
                </div>
                <div className="bg-rf-surface-subtle p-3.5 rounded-xl border border-rf-border-subtle">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5 min-h-7">
                    {(profile.certifications || []).map((cert) => (
                      <span key={cert} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-rf-surface border border-rf-border text-rf-ink shadow-2xs">
                        {cert}
                        <button type="button" onClick={() => handleRemoveCert(cert)} className="text-rf-ink-muted hover:text-rf-danger">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newCert}
                      onChange={(e) => setNewCert(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCert();
                        }
                      }}
                      placeholder="Add certification..."
                      className="h-8 text-xs bg-rf-surface"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddCert} type="button">Add</Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Summary / Bio */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-rf-surface-subtle text-rf-ink">
                  <Icon name="file-text" size={13} />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink">
                  Professional Summary / Recruiter Notes
                </h3>
              </div>
              <Textarea
                rows={3}
                value={profile.summary || ''}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                placeholder="Candidate executive summary, key achievements, or recruiter notes..."
                className="bg-rf-surface text-xs"
              />
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="border-t border-rf-border-subtle bg-rf-surface-subtle p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-rf-ink-muted flex items-center gap-1.5">
              <Icon name="info" size={14} className="text-rf-action" />
              <span>Clicking <strong>Validate & Process</strong> creates a controlled candidate intake batch ready for final database confirmation.</span>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button variant="secondary" size="sm" onClick={clearUpload} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="sgh-btn-gradient"
                loading={submitting}
                loadingLabel="Processing batch"
                onClick={() => void startImport()}
                type="button"
              >
                <Icon name="check-circle" size={15} />
                Validate & Process to Intake
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ─── IMPORT HISTORY TABLE ─── */}
      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <SectionHeader
          title="Import history and batches"
          description="Review and verify previous candidate import batches."
          density="compact"
          className="border-b border-rf-border-subtle p-4"
          actions={(
            <Button variant="ghost" size="sm" disabled={loadingJobs} onClick={() => void loadJobs()}>
              <Icon name="refresh-cw" size={13} className={loadingJobs ? 'animate-spin' : ''} />
              Refresh
            </Button>
          )}
        />

        {loadingJobs ? (
          <TableSkeleton columns={7} rows={5} />
        ) : jobs.length === 0 ? (
          <PageState kind="empty" title="No import batches yet" description="Upload a resume above to create the first controlled intake batch." />
        ) : (
          <ResponsiveDataView
            rows={jobs}
            columns={importJobColumns}
            rowKey={(job) => job.id}
            label="Import batches"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(job) => (
              <Button variant="secondary" size="sm" onClick={() => void navigate(`/cv-intake/${job.id}`)}>
                Open review
              </Button>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
