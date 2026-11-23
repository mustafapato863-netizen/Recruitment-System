import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import {
  FileText,
  Upload,
  CircleCheck,
  Lock,
  Plus,
  Sparkles,
  ShieldCheck,
  Scale,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { ButtonV2, DrawerV2, InputV2, SelectV2, StatusChip, SkeletonV2 } from '../../components/v2';
import type { JdCriteriaDefinition, VacancyDocumentItem } from '@recruitflow/contracts';
import { fetchVacancyJd, uploadVacancyJd, updateVacancyCriteria, saveVacancyJdText } from '../api/ats';
import { parseJobDescriptionText } from '../../utils/jdParser';

export interface JdReviewDrawerProps {
  vacancyId?: string;
  vacancyRequestId?: string;
  vacancyTitle?: string;
  title?: string;
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onLocked?: () => void;
}

export function JdReviewDrawer({
  vacancyId,
  vacancyRequestId,
  vacancyTitle,
  title,
  isOpen = true,
  open = true,
  onClose,
  onSaved,
  onLocked,
}: JdReviewDrawerProps) {
  const isDrawerOpen = isOpen && open;
  const targetId = vacancyId || vacancyRequestId || '';
  const displayTitle = title || vacancyTitle || 'Job Description & ATS Calibration';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingText, setAnalyzingText] = useState(false);
  const [textFeedback, setTextFeedback] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'write'>('upload');
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [document, setDocument] = useState<VacancyDocumentItem | null>(null);
  const [criteria, setCriteria] = useState<JdCriteriaDefinition | null>(null);

  const [newMustSkill, setNewMustSkill] = useState('');
  const [newNiceSkill, setNewNiceSkill] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDrawerOpen || !targetId) return;
    let active = true;
    setLoading(true);
    fetchVacancyJd(targetId)
      .then((data) => {
        if (!active) return;
        setDocument(data.document);
        if (data.document?.extractionText) {
          setJdText(data.document.extractionText);
        }
        setCriteria(
          data.criteria || {
            version: 1,
            isLocked: false,
            lockedAt: null,
            lockedById: null,
            minExperienceYears: null,
            educationLevels: [],
            languages: [],
            workMode: 'On-site',
            mustHaveSkills: [],
            niceToHaveSkills: [],
            knockoutRules: [],
            weights: { skills: 50, experience: 30, education: 10, languages: 10 },
          },
        );
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not load job description.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isDrawerOpen, targetId]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetId) return;

    setUploading(true);
    setError(null);
    try {
      const res = await uploadVacancyJd(targetId, file);
      setDocument(res.document);
      setCriteria(res.criteria);
      if (res.document?.extractionText) {
        setJdText(res.document.extractionText);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload and extract JD.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExtractFromText = async () => {
    if (!jdText.trim() || !targetId) return;
    setAnalyzingText(true);
    setError(null);
    setTextFeedback(null);
    try {
      // 1. Client-side parse for immediate preview and fallback
      const parsedLocal = parseJobDescriptionText(jdText);
      const mustSkills = (parsedLocal.requiredSkills || []).map((name, i) => ({
        id: `must-${Date.now()}-${i}`,
        name,
      }));
      const niceToHaveRaw = (parsedLocal as { niceToHaveSkills?: string[] }).niceToHaveSkills ?? [];
      const niceSkills = niceToHaveRaw.map((name: string, i: number) => ({
        id: `nice-${Date.now()}-${i}`,
        name,
      }));

      // 2. Server-side text sync & criteria generation
      try {
        const res = await saveVacancyJdText(targetId, jdText.trim());
        setDocument(res.document);
        setCriteria(res.criteria);
        setTextFeedback(`Updated criteria from text (${res.criteria.mustHaveSkills.length} must-have skills, ${res.criteria.niceToHaveSkills.length} nice-to-have skills extracted).`);
      } catch {
        // Fallback to local parsed criteria if backend text endpoint is unavailable
        if (criteria) {
          const mergedCriteria: JdCriteriaDefinition = {
            ...criteria,
            minExperienceYears: parsedLocal.minExperienceYears ?? criteria.minExperienceYears,
            mustHaveSkills: mustSkills.length > 0 ? mustSkills : criteria.mustHaveSkills,
            niceToHaveSkills: niceSkills.length > 0 ? niceSkills : criteria.niceToHaveSkills,
          };
          setCriteria(mergedCriteria);
          setTextFeedback(`Analyzed text (${mustSkills.length} must-have skills, ${niceSkills.length} nice-to-have skills extracted).`);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to analyze job description text.');
    } finally {
      setAnalyzingText(false);
    }
  };

  const handleAddMustSkill = () => {
    if (!newMustSkill.trim() || !criteria) return;
    const trimmed = newMustSkill.trim();
    if (criteria.mustHaveSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;

    setCriteria({
      ...criteria,
      mustHaveSkills: [
        ...criteria.mustHaveSkills,
        { id: `must-${Date.now()}`, name: trimmed },
      ],
      niceToHaveSkills: criteria.niceToHaveSkills.filter(
        (s) => s.name.toLowerCase() !== trimmed.toLowerCase(),
      ),
    });
    setNewMustSkill('');
  };

  const handleRemoveMustSkill = (id: string) => {
    if (!criteria) return;
    setCriteria({
      ...criteria,
      mustHaveSkills: criteria.mustHaveSkills.filter((s) => s.id !== id),
    });
  };

  const handleAddNiceSkill = () => {
    if (!newNiceSkill.trim() || !criteria) return;
    const trimmed = newNiceSkill.trim();
    if (criteria.niceToHaveSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;

    setCriteria({
      ...criteria,
      niceToHaveSkills: [
        ...criteria.niceToHaveSkills,
        { id: `nice-${Date.now()}`, name: trimmed },
      ],
      mustHaveSkills: criteria.mustHaveSkills.filter(
        (s) => s.name.toLowerCase() !== trimmed.toLowerCase(),
      ),
    });
    setNewNiceSkill('');
  };

  const handleRemoveNiceSkill = (id: string) => {
    if (!criteria) return;
    setCriteria({
      ...criteria,
      niceToHaveSkills: criteria.niceToHaveSkills.filter((s) => s.id !== id),
    });
  };

  const handleSave = async (lock = false) => {
    if (!criteria || !targetId) return;
    setSaving(true);
    setError(null);
    try {
      if (jdText.trim() && (!document || document.extractionText !== jdText.trim())) {
        try {
          await saveVacancyJdText(targetId, jdText.trim());
        } catch {
          // non-blocking text sync
        }
      }
      const payload: Partial<JdCriteriaDefinition> = {
        ...criteria,
        isLocked: lock || criteria.isLocked,
      };
      const saved = await updateVacancyCriteria(targetId, payload);
      setCriteria(saved);
      onSaved?.();
      if (lock) {
        onLocked?.();
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save criteria.');
    } finally {
      setSaving(false);
    }
  };

  if (!isDrawerOpen) return null;

  return (
    <DrawerV2
      open={isDrawerOpen}
      onClose={onClose}
      title="Job Description & ATS Calibration"
      subtitle={displayTitle}
      primaryAction={
        <ButtonV2
          kind="primary"
          size="md"
          icon={<Lock size={15} />}
          loading={saving}
          disabled={uploading || loading || (criteria?.isLocked ?? false)}
          onClick={() => void handleSave(true)}
        >
          {criteria?.isLocked ? 'Criteria Locked' : 'Lock & Calibrate ATS'}
        </ButtonV2>
      }
      secondaryAction={
        <div className="flex items-center gap-2">
          <ButtonV2 kind="secondary" size="md" onClick={onClose}>
            Cancel
          </ButtonV2>
          <ButtonV2
            kind="secondary"
            size="md"
            loading={saving}
            disabled={uploading || loading}
            onClick={() => void handleSave(false)}
          >
            Save Draft
          </ButtonV2>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4 p-4">
          <SkeletonV2 lines={5} />
        </div>
      ) : (
        <div className="space-y-6 p-1 text-[var(--rf2-ink)]">
          {error ? (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--rf2-danger-tint)] p-3 text-xs font-semibold text-[var(--rf2-danger)]" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Section 1: Attachment & Extraction */}
          <div className="rounded-2xl border border-[var(--rf2-divider)] bg-[var(--rf2-card)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-[var(--rf2-action)]" size={18} />
                <h3 className="text-sm font-bold text-[var(--rf2-ink)] m-0">JD Document &amp; Requirements</h3>
              </div>
              <div className="flex items-center rounded-lg bg-[var(--rf2-well)] p-0.5 text-xs font-semibold" role="tablist" aria-label="JD input mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'upload'}
                  onClick={() => setMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${mode === 'upload' ? 'bg-[var(--rf2-card)] text-[var(--rf2-ink)] shadow-sm' : 'text-[var(--rf2-muted)] hover:text-[var(--rf2-ink)]'}`}
                >
                  <Upload size={13} />
                  <span>Upload JD file</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'write'}
                  onClick={() => setMode('write')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${mode === 'write' ? 'bg-[var(--rf2-card)] text-[var(--rf2-ink)] shadow-sm' : 'text-[var(--rf2-muted)] hover:text-[var(--rf2-ink)]'}`}
                >
                  <Edit3 size={13} />
                  <span>Write / Edit JD text</span>
                </button>
              </div>
            </div>

            {mode === 'upload' ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--rf2-muted)]">Upload a PDF, DOCX, or text file to extract qualifications and competencies.</span>
                  {document ? (
                    <StatusChip tone="success" label={`Extracted (${document.parserStatus})`} />
                  ) : (
                    <StatusChip tone="neutral" label="No file uploaded" />
                  )}
                </div>

                {document ? (
                  <div className="flex items-center justify-between rounded-xl bg-[var(--rf2-well)] p-3 text-xs mb-3">
                    <div className="min-w-0">
                      <span className="block font-semibold truncate text-[var(--rf2-ink)]">{document.fileName}</span>
                      <span className="block text-[11px] text-[var(--rf2-muted)]">
                        {(document.fileSize / 1024).toFixed(1)} KB · Uploaded {new Date(document.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <ButtonV2
                      kind="secondary"
                      size="sm"
                      icon={<Upload size={13} />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      Replace File
                    </ButtonV2>
                  </div>
                ) : null}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                  aria-label="Upload Job Description document"
                />

                {!document ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    aria-label="Upload Job Description (PDF, DOCX, TXT)"
                    className="grid place-items-center rounded-xl border border-dashed border-[var(--rf2-divider)] p-6 text-center cursor-pointer hover:bg-[var(--rf2-well)] transition"
                  >
                    <Upload className="mx-auto text-[var(--rf2-muted)] mb-2" size={24} />
                    <p className="text-xs font-bold text-[var(--rf2-ink)] m-0">Upload Job Description (PDF, DOCX, TXT)</p>
                    <p className="text-[11px] text-[var(--rf2-muted)] mt-1 mb-0">Automatic parsing extracts skills, experience, and knockout rules</p>
                    {uploading ? <p className="text-xs text-[var(--rf2-action)] font-semibold mt-2">Extracting requirements...</p> : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="jd-raw-text" className="text-xs font-bold text-[var(--rf2-ink)]">
                    Job Description Text (Summary, Duties &amp; Requirements)
                  </label>
                  {jdText.trim() ? (
                    <span className="text-[11px] text-[var(--rf2-muted)]">
                      {jdText.trim().split(/\s+/).length} words
                    </span>
                  ) : null}
                </div>
                <textarea
                  id="jd-raw-text"
                  rows={8}
                  value={jdText}
                  onChange={(e) => {
                    setJdText(e.target.value);
                    setTextFeedback(null);
                  }}
                  placeholder="Type or paste the job description here... (Include overview, clinical/technical duties, must-have skills, required qualifications, and min experience years)"
                  className="w-full rounded-xl border border-[var(--rf2-divider)] bg-[var(--rf2-card)] p-3 text-xs leading-relaxed text-[var(--rf2-ink)] placeholder-[var(--rf2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--rf2-action)] font-sans resize-y"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ButtonV2
                    type="button"
                    kind="secondary"
                    size="sm"
                    icon={<Sparkles size={14} className="text-[var(--rf2-action)]" />}
                    loading={analyzingText}
                    disabled={!jdText.trim()}
                    onClick={() => void handleExtractFromText()}
                  >
                    Extract &amp; Update Requirements
                  </ButtonV2>
                  {textFeedback ? (
                    <span className="text-xs font-semibold text-[var(--rf2-success)] flex items-center gap-1">
                      <CircleCheck size={13} /> {textFeedback}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--rf2-muted)]">
                      Extracts must-have skills, nice-to-have skills, and experience criteria from this text.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Must-Have Skills */}
          <div className="rounded-2xl border border-[var(--rf2-divider)] bg-[var(--rf2-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-[var(--rf2-action)]" size={18} />
                <h3 className="text-sm font-bold text-[var(--rf2-ink)] m-0">Must-Have Skills (Required)</h3>
              </div>
              <span className="text-[11px] font-semibold text-[var(--rf2-muted)]">
                {criteria?.mustHaveSkills.length || 0} configured
              </span>
            </div>
            <p className="text-xs text-[var(--rf2-muted)] mb-3">
              Candidates missing any must-have skill are flagged in the ATS dashboard.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {criteria?.mustHaveSkills.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--rf2-success-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--rf2-ink)] border border-[var(--rf2-divider)]"
                >
                  <CircleCheck size={13} className="text-[var(--rf2-success)]" />
                  <span>{s.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMustSkill(s.id)}
                    className="cursor-pointer text-[var(--rf2-muted)] hover:text-[var(--rf2-danger)] transition ml-1"
                    title={`Remove ${s.name}`}
                    aria-label={`Remove ${s.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {(!criteria?.mustHaveSkills || criteria.mustHaveSkills.length === 0) && (
                <span className="text-xs text-[var(--rf2-muted)] italic">No must-have skills defined.</span>
              )}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <InputV2
                  label="Add Must-Have Skill"
                  value={newMustSkill}
                  onChange={(e) => setNewMustSkill(e.target.value)}
                  placeholder="Add must-have skill (e.g. ICU, Patient Care)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMustSkill();
                    }
                  }}
                />
              </div>
              <ButtonV2 kind="secondary" size="md" icon={<Plus size={14} />} onClick={handleAddMustSkill}>
                Add
              </ButtonV2>
            </div>
          </div>

          {/* Section 3: Nice-to-Have Skills */}
          <div className="rounded-2xl border border-[var(--rf2-divider)] bg-[var(--rf2-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-[var(--rf2-action)]" size={18} />
                <h3 className="text-sm font-bold text-[var(--rf2-ink)] m-0">Nice-to-Have Skills (Preferred)</h3>
              </div>
              <span className="text-[11px] font-semibold text-[var(--rf2-muted)]">
                {criteria?.niceToHaveSkills.length || 0} configured
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {criteria?.niceToHaveSkills.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--rf2-well)] px-2.5 py-1 text-xs font-semibold text-[var(--rf2-ink)] border border-[var(--rf2-divider)]"
                >
                  <span>{s.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveNiceSkill(s.id)}
                    className="cursor-pointer text-[var(--rf2-muted)] hover:text-[var(--rf2-danger)] transition ml-1"
                    title={`Remove ${s.name}`}
                    aria-label={`Remove ${s.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {(!criteria?.niceToHaveSkills || criteria.niceToHaveSkills.length === 0) && (
                <span className="text-xs text-[var(--rf2-muted)] italic">No nice-to-have skills defined.</span>
              )}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <InputV2
                  label="Add Nice-To-Have Skill"
                  value={newNiceSkill}
                  onChange={(e) => setNewNiceSkill(e.target.value)}
                  placeholder="Add nice-to-have skill (e.g. Arabic, Healthcare Quality)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNiceSkill();
                    }
                  }}
                />
              </div>
              <ButtonV2 kind="secondary" size="md" icon={<Plus size={14} />} onClick={handleAddNiceSkill}>
                Add
              </ButtonV2>
            </div>
          </div>

          {/* Section 4: Experience, Work Mode & Weights */}
          <div className="rounded-2xl border border-[var(--rf2-divider)] bg-[var(--rf2-card)] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="text-[var(--rf2-action)]" size={18} />
              <h3 className="text-sm font-bold text-[var(--rf2-ink)] m-0">Experience & Weights</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <InputV2
                  label="Min Experience (Years)"
                  type="number"
                  value={criteria?.minExperienceYears ?? ''}
                  onChange={(e) =>
                    setCriteria((prev) =>
                      prev ? { ...prev, minExperienceYears: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) } : null,
                    )
                  }
                />
              </div>

              <div>
                <SelectV2
                  label="Work Mode"
                  value={criteria?.workMode ?? 'On-site'}
                  onChange={(e) =>
                    setCriteria((prev) =>
                      prev ? { ...prev, workMode: e.target.value as 'On-site' | 'Hybrid' | 'Remote' } : null,
                    )
                  }
                >
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </SelectV2>
              </div>
            </div>

            <div className="border-t border-[var(--rf2-divider)] pt-3">
              <span className="block text-xs font-bold text-[var(--rf2-ink)] mb-2">ATS Scoring Weights (%)</span>
              <p className="text-[11px] text-[var(--rf2-muted)] mb-2">Configured weights; only skills and experience with evaluable evidence count toward the current score. Qualifications still require recruiter verification.</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-xl bg-[var(--rf2-well)] p-2">
                  <span className="block font-extrabold text-[var(--rf2-action)]">50%</span>
                  <span className="text-[10px] text-[var(--rf2-muted)]">Skills</span>
                </div>
                <div className="rounded-xl bg-[var(--rf2-well)] p-2">
                  <span className="block font-extrabold text-[var(--rf2-action)]">30%</span>
                  <span className="text-[10px] text-[var(--rf2-muted)]">Experience</span>
                </div>
                <div className="rounded-xl bg-[var(--rf2-well)] p-2">
                  <span className="block font-extrabold text-[var(--rf2-action)]">10%</span>
                  <span className="text-[10px] text-[var(--rf2-muted)]">Education</span>
                </div>
                <div className="rounded-xl bg-[var(--rf2-well)] p-2">
                  <span className="block font-extrabold text-[var(--rf2-action)]">10%</span>
                  <span className="text-[10px] text-[var(--rf2-muted)]">Languages</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DrawerV2>
  );
}
