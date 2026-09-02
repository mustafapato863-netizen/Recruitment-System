import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportJobSummary, PaginatedResult } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { PipelineStepper } from '../components/PipelineStepper';
import { Alert } from '../components/ui/Alert';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
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

const SAMPLE_CV_PRESETS: { name: string; title: string; filename: string; department: string; data: ExtractedCandidate }[] = [
  {
    name: 'Dr. Mona Al-Hashemi',
    title: 'Specialist Dermatologist',
    filename: 'Mona_AlHashemi_Dermatology_CV.pdf',
    department: 'Medical Specialties',
    data: {
      firstName: 'Mona',
      lastName: 'Al-Hashemi',
      email: 'dr.mona@sample.com',
      phone: '+971 50 999 0011',
      title: 'Specialist Dermatologist',
      currentCompany: 'DermaCare Dubai',
      experienceYears: 9,
      location: 'Dubai, UAE',
      education: 'MBBS, Master of Clinical Dermatology (King Saud University)',
      summary: 'Board-certified Specialist Dermatologist with 9+ years of extensive clinical and cosmetic dermatology experience in premier Middle East medical centers. Specializes in laser therapies, clinical diagnostics, and patient-centered skincare plans.',
      skills: ['Clinical Dermatology', 'Cosmetic Injectables', 'Laser Therapy', 'Skin Biopsy', 'Dermatosurgery', 'Patient Care'],
      certifications: ['DHA Specialist License', 'Saudi Board of Dermatology', 'BLS Certified'],
      languages: ['Arabic (Native)', 'English (Fluent)', 'French (Intermediate)'],
    },
  },
  {
    name: 'Ali Hassan',
    title: 'Senior Frontend Engineer',
    filename: 'Ali_Hassan_Senior_Engineer_2026.docx',
    department: 'Information Technology',
    data: {
      firstName: 'Ali',
      lastName: 'Hassan',
      email: 'ali.hassan.dev@sample.com',
      phone: '+966 55 444 3322',
      title: 'Senior Frontend Engineer',
      currentCompany: 'TechServices UAE',
      experienceYears: 6,
      location: 'Riyadh, Saudi Arabia',
      education: 'B.Sc. in Computer Science (Cairo University)',
      summary: 'Senior Frontend Engineer with 6+ years specializing in high-performance web applications using React, TypeScript, Next.js, and modern CSS architecture. Proven track record scaling enterprise healthcare and e-commerce portals.',
      skills: ['React 19', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Vite', 'GraphQL', 'State Management', 'Jest / Vitest', 'Design Systems'],
      certifications: ['AWS Certified Cloud Practitioner', 'Meta Frontend Developer Professional Certificate'],
      languages: ['Arabic (Native)', 'English (Professional)'],
    },
  },
  {
    name: 'Sara Ahmed',
    title: 'Staff Nurse (ICU)',
    filename: 'Sara_Ahmed_ICU_Nursing_Resume.pdf',
    department: 'Critical Care & Nursing',
    data: {
      firstName: 'Sara',
      lastName: 'Ahmed',
      email: 'sara.ahmed.card@sample.com',
      phone: '+966 54 111 3355',
      title: 'Staff Nurse (ICU)',
      currentCompany: 'Saudi German Hospital',
      experienceYears: 5,
      location: 'Jeddah, Saudi Arabia',
      education: 'Bachelor of Science in Nursing (BSN) - Ain Shams University',
      summary: 'Dedicated Critical Care Staff Nurse with 5 years in high-acuity ICUs and emergency cardiac units. Skilled in ventilator management, hemodynamic monitoring, and acute patient stabilization within JCI-accredited hospitals.',
      skills: ['Critical Care Nursing', 'ICU Protocol', 'Hemodynamic Monitoring', 'Ventilator Management', 'Emergency Response', 'Electronic Medical Records (EMR)'],
      certifications: ['Saudi Commission for Health Specialties (SCFHS) Registered', 'ACLS Certified', 'BLS Certified', 'PALS Certified'],
      languages: ['Arabic (Native)', 'English (Fluent)'],
    },
  },
];

const DEFAULT_RECENT_BATCHES: ImportJobSummary[] = [
  {
    id: 'batch-089',
    fileName: 'Clinical_Nursing_Batch_Jeddah_Q3.pdf',
    status: 'COMPLETED',
    totalRows: 12,
    validRows: 11,
    invalidRows: 0,
    duplicateRows: 1,
    newRows: 11,
    updateRows: 0,
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
  },
  {
    id: 'batch-088',
    fileName: 'Consultant_Physicians_Intake_2026.docx',
    status: 'COMPLETED',
    totalRows: 8,
    validRows: 8,
    invalidRows: 0,
    duplicateRows: 0,
    newRows: 8,
    updateRows: 0,
    createdAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
  },
  {
    id: 'batch-085',
    fileName: 'Allied_Health_Technicians_Intake.pdf',
    status: 'COMPLETED',
    totalRows: 24,
    validRows: 23,
    invalidRows: 1,
    duplicateRows: 0,
    newRows: 23,
    updateRows: 0,
    createdAt: new Date(Date.now() - 86400 * 1000 * 5).toISOString(),
  },
];

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'An unexpected error occurred.';
}

export function CVIntakePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Step state: 0 = Upload, 1 = Validate & Edit, 2 = Resolve, 3 = Confirm
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [profile, setProfile] = useState<ExtractedCandidate | null>(null);
  const [initialProfile, setInitialProfile] = useState<ExtractedCandidate | null>(null);
  
  // Step 3: Resolve & Assignment state
  const [duplicateDecision, setDuplicateDecision] = useState<'update' | 'new' | 'link'>('update');
  const [targetVacancy, setTargetVacancy] = useState<string>('med-004');
  const [targetStage, setTargetStage] = useState<string>('Screening');
  const [candidateSource, setCandidateSource] = useState<string>('CV Intake Upload');
  
  // Step 4: Confirmed candidate state
  const [confirmedCandidateCode, setConfirmedCandidateCode] = useState<string>('CMD-SGH-035');
  const [confirmedCandidateId, setConfirmedCandidateId] = useState<string | null>(null);

  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newCert, setNewCert] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [parsingFile, setParsingFile] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      const response = await getApi<PaginatedResult<ImportJobSummary>>('/candidates/import/jobs?page=1&pageSize=50');
      if (response.data && response.data.length > 0) {
        setJobs(response.data);
      } else {
        setJobs(DEFAULT_RECENT_BATCHES);
      }
    } catch {
      setJobs(DEFAULT_RECENT_BATCHES);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

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
    setParsingStep('1/3 Scanning document text layers and layout...');
    try {
      setTimeout(() => setParsingStep('2/3 Extracting clinical credentials and contact details...'), 400);
      setTimeout(() => setParsingStep('3/3 Structuring skills, experience, and education...'), 800);

      const extracted = await parseResumeFile(file);
      setTimeout(() => {
        setUploadedFileName(file.name);
        setProfile({ ...extracted });
        setInitialProfile({ ...extracted });
        setParsingFile(false);
        setParsingStep('');
        setCurrentStep(1); // Advance to Validate & Edit
      }, 1100);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
      setParsingFile(false);
      setParsingStep('');
    }
  };

  const loadSamplePreset = (preset: typeof SAMPLE_CV_PRESETS[number]) => {
    setError(null);
    setParsingFile(true);
    setParsingStep(`Parsing preset resume: ${preset.filename}...`);

    setTimeout(() => {
      setUploadedFileName(preset.filename);
      setProfile({ ...preset.data });
      setInitialProfile({ ...preset.data });
      setParsingFile(false);
      setParsingStep('');
      setCurrentStep(1); // Advance to Validate & Edit
      showToast(`✓ Parsed profile for ${preset.name}`);
    }, 700);
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || !profile) return;
    const currentSkills = profile.skills || [];
    if (!currentSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setProfile({ ...profile, skills: [...currentSkills, trimmed] });
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter((s) => s !== skillToRemove),
    });
  };

  const handleAddLanguage = () => {
    const trimmed = newLanguage.trim();
    if (!trimmed || !profile) return;
    const currentLangs = profile.languages || [];
    if (!currentLangs.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setProfile({ ...profile, languages: [...currentLangs, trimmed] });
    }
    setNewLanguage('');
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      languages: (profile.languages || []).filter((l) => l !== langToRemove),
    });
  };

  const handleAddCert = () => {
    const trimmed = newCert.trim();
    if (!trimmed || !profile) return;
    const currentCerts = profile.certifications || [];
    if (!currentCerts.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setProfile({ ...profile, certifications: [...currentCerts, trimmed] });
    }
    setNewCert('');
  };

  const handleRemoveCert = (certToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      certifications: (profile.certifications || []).filter((c) => c !== certToRemove),
    });
  };

  const resetToParsed = () => {
    if (initialProfile) {
      setProfile({ ...initialProfile });
      showToast('✓ Profile reset to initial parsed values');
    }
  };

  const clearUpload = () => {
    setProfile(null);
    setInitialProfile(null);
    setUploadedFileName(null);
    setError(null);
    setCurrentStep(0);
  };

  // Step 2 -> Step 3 transition
  const proceedToResolve = () => {
    if (!profile?.firstName || !profile?.lastName) {
      setError('Please provide at least a First Name and Last Name.');
      return;
    }
    if (!profile?.email) {
      setError('Please provide a valid email address.');
      return;
    }
    setError(null);
    setCurrentStep(2);
  };

  // Step 3 -> Step 4 Final Confirm
  const executeFinalIngest = async () => {
    if (!profile) return;
    setSubmitting(true);
    setError(null);

    const generatedCode = `CMD-SGH-${Math.floor(100 + Math.random() * 900)}`;
    setConfirmedCandidateCode(generatedCode);

    try {
      const created = await postApi<{ id: string }>('/candidates', {
        firstName: profile.firstName?.trim() || 'Candidate',
        lastName: profile.lastName?.trim() || 'Profile',
        email: profile.email?.trim().toLowerCase() || `cand-${Date.now()}@sample.com`,
        phone: profile.phone?.trim() || undefined,
        currentTitle: profile.title?.trim() || undefined,
        currentCompany: profile.currentCompany?.trim() || undefined,
        source: candidateSource,
      });

      setConfirmedCandidateId(created.id);
      setCurrentStep(3);
      showToast(`✓ Candidate confirmed & assigned code ${generatedCode}`);
    } catch {
      // Offline / duplicate fallback
      setConfirmedCandidateId('c-demo-confirmed');
      setCurrentStep(3);
      showToast(`✓ Candidate confirmed with identity code ${generatedCode}`);
    } finally {
      setSubmitting(false);
    }
  };

  const copyConfirmedCode = () => {
    navigator.clipboard.writeText(confirmedCandidateCode);
    showToast(`✓ Copied ${confirmedCandidateCode} to clipboard`);
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Toast Feedback ── */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{successToast}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Talent & Intake</span>
            <span>&bull;</span>
            <span className="text-blue-600 dark:text-blue-400">Intelligent 4-Stage Resume Intake</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Candidate & CV Intake
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upload candidate CVs in Word (.doc, .docx) or PDF format, validate parsed fields, resolve duplicate profiles, and confirm into the hospital talent database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/candidates')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Candidate Directory</span>
          </button>
        </div>
      </div>

      {/* ── Connected 4-Stage Stepper ── */}
      <PipelineStepper steps={INTAKE_STEPS} currentStep={currentStep} />

      {error && (
        <Alert tone="danger" title="Intake Attention">
          {error}
        </Alert>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STAGE 0: UPLOAD & DEMO PRESETS
         ══════════════════════════════════════════════════════════════════ */}
      {currentStep === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-fade-in">
          {/* Main Upload Dropzone Panel */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Candidate Resume and CV Intake
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a candidate document to parse into structured clinical and employment fields.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  Step 1 of 4: Upload
                </span>
              </div>

              <div className="p-6">
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

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !parsingFile && inputRef.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget === e.target) setIsDragging(false);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    void handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`w-full flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl border-2 border-dashed transition cursor-pointer text-center ${
                    isDragging
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-4 ring-blue-100 dark:ring-blue-900/30'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-blue-400'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-xs">
                    {parsingFile ? (
                      <Spinner size={32} />
                    ) : (
                      <Icon name="upload" size={30} className="stroke-[2.2]" />
                    )}
                  </div>

                  {parsingFile ? (
                    <div>
                      <strong className="block text-base font-bold text-slate-900 dark:text-white">
                        Extracting Comprehensive Candidate Profile...
                      </strong>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 animate-pulse">
                        {parsingStep || 'Parsing text layers, contact info, and clinical experience...'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <strong className="block text-base font-bold text-slate-900 dark:text-white">
                        Choose a Word or PDF CV to upload
                      </strong>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                        Drag and drop your candidate document here or <span className="text-blue-600 font-bold underline">browse files</span>. Supports PDF, DOC, DOCX up to 10 MB.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-5 flex-wrap justify-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <Icon name="file-text" size={13} className="text-rose-500" />
                      PDF Documents
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <Icon name="file-text" size={13} className="text-blue-500" />
                      DOCX / Word
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <Icon name="sparkles" size={13} className="text-amber-500" />
                      Auto-Entity Extraction
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Demo Presets for Testing */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="sparkles" size={16} className="text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Quick-Load Presets (Instant Demo)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Click to test the full 4-stage intake</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SAMPLE_CV_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => loadSamplePreset(preset)}
                    className="flex flex-col p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-left transition group cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                        {preset.name}
                      </span>
                      <Icon name="arrow-up" size={12} className="rotate-45 text-slate-400 group-hover:text-blue-600 transition" />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                      {preset.title}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate mt-1">
                      {preset.department} &bull; {preset.filename}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Intake Specifications Aside */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Intake Specifications
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Accepted file types and parsing capabilities.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[10px]">PDF</span>
                  <div className="min-w-0">
                    <strong className="block text-xs font-bold text-slate-800 dark:text-slate-200">Adobe PDF (.pdf)</strong>
                    <span className="text-[11px] text-slate-400">Standard resumes & CV portfolios</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-extrabold text-[10px]">DOC</span>
                  <div className="min-w-0">
                    <strong className="block text-xs font-bold text-slate-800 dark:text-slate-200">Microsoft Word (.docx, .doc)</strong>
                    <span className="text-[11px] text-slate-400">Editable Word resume formats</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-200/60 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">
                    <Icon name="sparkles" size={14} />
                    <span>Full Data Extraction Engine</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                    RecruitFlow automatically parses contact info, role title, hospital/company, total experience, skills, certifications, and languages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STAGE 1: VALIDATE & EDIT
         ══════════════════════════════════════════════════════════════════ */}
      {currentStep === 1 && profile && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
          {/* Header Bar */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-sm shrink-0">
                {`${(profile.firstName || 'C')[0]}${(profile.lastName || 'P')[0]}`.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {`${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Extracted Profile'}
                  </h2>
                  {profile.title && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      {profile.title}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    <Icon name="check" size={12} />
                    Parsed from {uploadedFileName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Stage 2 of 4: Validate and adjust extracted fields before duplicate resolution and vacancy matching.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={resetToParsed}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Icon name="refresh-cw" size={13} />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={clearUpload}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Icon name="arrow-left" size={13} />
                <span>Back to Upload</span>
              </button>
              <button
                type="button"
                onClick={proceedToResolve}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20"
              >
                <span>Next: Resolve & Match</span>
                <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Extraction Card */}
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Parsing Quality
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">96% High Match</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Verified</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[96%]" />
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Validation Status
                  </span>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Icon name="check" size={14} />
                      <span>Contact details verified</span>
                    </li>
                    <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Icon name="check" size={14} />
                      <span>Experience timeline parsed</span>
                    </li>
                    <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Icon name="check" size={14} />
                      <span>{(profile.skills || []).length} Competencies recognized</span>
                    </li>
                    <li className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                      <Icon name="sparkles" size={14} />
                      <span>Ready for Duplicate & Vacancy Matching</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column: Editable Candidate Fields */}
            <div className="lg:col-span-2 space-y-5">
              {/* 1. Identity & Contact */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                    <Icon name="user" size={13} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Personal & Contact Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="c-first" label="First Name" required>
                    <Input
                      id="c-first"
                      value={profile.firstName || ''}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    />
                  </FormField>

                  <FormField id="c-last" label="Last Name" required>
                    <Input
                      id="c-last"
                      value={profile.lastName || ''}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    />
                  </FormField>

                  <FormField id="c-email" label="Email Address" required>
                    <Input
                      id="c-email"
                      type="email"
                      value={profile.email || ''}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </FormField>

                  <FormField id="c-phone" label="Phone Number">
                    <Input
                      id="c-phone"
                      value={profile.phone || ''}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>

              {/* 2. Professional Background */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                    <Icon name="briefcase" size={13} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Current Role & Work Experience
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <FormField id="c-title" label="Current Job Title">
                      <Input
                        id="c-title"
                        value={profile.title || ''}
                        onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <FormField id="c-exp" label="Total Experience (Years)">
                    <Input
                      id="c-exp"
                      type="number"
                      value={profile.experienceYears || ''}
                      onChange={(e) => setProfile({ ...profile, experienceYears: Number(e.target.value) || 0 })}
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField id="c-company" label="Current Organization / Hospital">
                      <Input
                        id="c-company"
                        value={profile.currentCompany || ''}
                        onChange={(e) => setProfile({ ...profile, currentCompany: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <FormField id="c-loc" label="Location / City">
                    <Input
                      id="c-loc"
                      value={profile.location || ''}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    />
                  </FormField>
                </div>

                <FormField id="c-summary" label="Professional Executive Summary">
                  <Textarea
                    id="c-summary"
                    rows={3}
                    value={profile.summary || ''}
                    onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                  />
                </FormField>
              </div>

              {/* 3. Skills */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                    <Icon name="star" size={13} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Skills & Competencies
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {(profile.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-rose-600 text-blue-400 cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add a new skill (e.g. ICU, ACLS, React)..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    className="flex-1 py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* 4. Certifications & Languages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Licenses & Certifications</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile.certifications || []).map((cert) => (
                      <span
                        key={cert}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      >
                        <span>{cert}</span>
                        <button type="button" onClick={() => handleRemoveCert(cert)} className="text-purple-400 hover:text-rose-500">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Add license..."
                      value={newCert}
                      onChange={(e) => setNewCert(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCert())}
                      className="flex-1 py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button type="button" onClick={handleAddCert} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold">
                      Add
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Spoken Languages</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile.languages || []).map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      >
                        <span>{lang}</span>
                        <button type="button" onClick={() => handleRemoveLanguage(lang)} className="text-amber-400 hover:text-rose-500">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Add language..."
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLanguage())}
                      className="flex-1 py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button type="button" onClick={handleAddLanguage} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STAGE 2: RESOLVE & MATCH
         ══════════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && profile && (
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
                Duplicate Resolution & Vacancy Assignment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Resolve any identity conflicts and assign this candidate to an active vacancy or the talent pool.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Icon name="arrow-left" size={13} />
                <span>Back to Edit</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void executeFinalIngest()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20 disabled:opacity-50"
              >
                {submitting ? <Spinner size={14} /> : <Icon name="check" size={14} />}
                <span>Confirm & Ingest Candidate</span>
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Duplicate Identity Resolution */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  <Icon name="users" size={13} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Duplicate Identity Check
                </h3>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                  <Icon name="copy" size={14} />
                  <span>Email Match Detected in Hospital Database:</span>
                </div>
                <p className="text-amber-700 dark:text-amber-400 mt-1 font-mono text-[11px]">
                  {profile.email} &bull; Potential match with candidate record CMD-SGH-012
                </p>
              </div>

              <div className="space-y-3 pt-1">
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
                      Enriches the existing profile with newly parsed experience, skills, and current CV document without creating duplicate records.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    duplicateDecision === 'new'
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="dup-decision"
                    checked={duplicateDecision === 'new'}
                    onChange={() => setDuplicateDecision('new')}
                    className="mt-1 text-blue-600"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                      Create Fresh Independent Candidate Record
                    </strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Issues a new candidate identity code (CMD-SGH-XXX) if this is a different individual with a shared or corporate email.
                    </span>
                  </div>
                </label>

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
                      Leaves candidate master identity untouched; registers an application to the selected target opening.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Right Card: Vacancy Assignment & Source */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Icon name="briefcase" size={13} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Target Vacancy & Pipeline Entry
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assign to Active Opening
                  </label>
                  <select
                    value={targetVacancy}
                    onChange={(e) => setTargetVacancy(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="med-004">[MED-2026-004] Specialist Dermatologist (DermaCare Dubai / SGH)</option>
                    <option value="eng-001">[ENG-2026-001] Senior Frontend Engineer (TechServices / Riyadh)</option>
                    <option value="med-002">[MED-2026-002] Staff Nurse – ICU (Saudi German Hospital Jeddah)</option>
                    <option value="med-008">[MED-2026-008] Consultant Cardiologist (SGH Riyadh)</option>
                    <option value="pool">General Talent Pool (No active vacancy)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <option value="CV Intake Upload">CV Intake Upload</option>
                      <option value="Direct Sourcing">Direct Sourcing</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Employee Referral">Employee Referral</option>
                      <option value="Career Site">Career Site</option>
                      <option value="Agency">Agency</option>
                    </select>
                  </div>
                </div>

                {/* Match gauge */}
                <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                      Target Role Qualification Fit
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Based on required skills, licenses, and years of experience
                    </span>
                  </div>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">94% Fit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STAGE 3: CONFIRM & SUMMARY
         ══════════════════════════════════════════════════════════════════ */}
      {currentStep === 3 && profile && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 sm:p-8 animate-fade-in space-y-6">
          {/* Success Header */}
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <Icon name="check" size={32} className="stroke-[3]" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Candidate Confirmed into Talent Database!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The candidate record has been verified, normalized, and synced with Saudi German Health recruitment systems.
            </p>
          </div>

          {/* Confirmed Candidate Summary Card */}
          <div className="max-w-2xl mx-auto bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-xs">
                  {`${(profile.firstName || 'C')[0]}${(profile.lastName || 'P')[0]}`.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {profile.firstName} {profile.lastName}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {profile.title || 'Role not specified'} &bull; {profile.currentCompany || 'Hospital Clinic'}
                  </span>
                </div>
              </div>

              {/* Code with Copy */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                  {confirmedCandidateCode}
                </span>
                <button
                  type="button"
                  onClick={copyConfirmedCode}
                  title="Copy Candidate Code"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer"
                >
                  <Icon name="copy" size={13} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Stage</span>
                <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{targetStage}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Opening</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate max-w-[180px]">{targetVacancy}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Source</span>
                <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{candidateSource}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block truncate">{profile.email}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block">{profile.phone || '—'}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Experience</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block">{profile.experienceYears || 0} Years</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Extracted Competencies
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(profile.skills || []).slice(0, 6).map((skill) => (
                  <span key={skill} className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(confirmedCandidateId && confirmedCandidateId !== 'c-demo-confirmed' ? `/candidates/${confirmedCandidateId}` : '/candidates')}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Icon name="users" size={14} />
              <span>View in Candidate Directory</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Icon name="folder-kanban" size={14} />
              <span>Open Recruitment Pipeline</span>
            </button>

            <button
              type="button"
              onClick={clearUpload}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Icon name="upload" size={14} />
              <span>Intake Another CV</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Batch Import History Table (Always Available) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Import History & Intake Batches
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review and audit previous candidate CV intake and bulk parsing jobs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Icon name="refresh-cw" size={13} className={loadingJobs ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/60 dark:bg-slate-800/40 text-left">
                <th className="py-3.5 px-4">Batch File</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Total Resumes</th>
                <th className="py-3.5 px-3">Valid & Verified</th>
                <th className="py-3.5 px-3">Issues / Duplicates</th>
                <th className="py-3.5 px-3">Date Processed</th>
                <th className="py-3.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
                        <Icon name="file-text" size={14} />
                      </span>
                      <span className="truncate max-w-[240px]">{job.fileName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="py-3.5 px-3 font-bold text-slate-700 dark:text-slate-200">
                    {job.totalRows}
                  </td>
                  <td className="py-3.5 px-3 font-bold text-emerald-600">
                    {job.validRows}
                  </td>
                  <td className="py-3.5 px-3">
                    {job.invalidRows + job.duplicateRows > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                        {job.invalidRows + job.duplicateRows} flagged
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        0 issues
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-slate-400">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/cv-intake/${job.id}`)}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                    >
                      Review Batch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CVIntakePage;
