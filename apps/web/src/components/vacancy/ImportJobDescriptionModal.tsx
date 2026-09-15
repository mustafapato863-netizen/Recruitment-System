import { useState, useRef, type ChangeEvent } from 'react';
import { patchApi, postApi, getApi } from '../../api/client';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { parseJobDescriptionFile, type ParsedJobDescription } from '../../utils/jdParser';

export interface ImportJobDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetVacancy?: {
    id: string;
    title: string;
    department?: string;
    location?: string;
    status?: string;
  } | null;
  availableVacancies?: Array<{
    id: string;
    title: string;
    department?: string;
    status?: string;
  }>;
  onSuccess: (result: {
    vacancyId?: string;
    updatedTitle: string;
    skillsCount: number;
    isNewRequisition: boolean;
  }) => void;
}

export function ImportJobDescriptionModal({
  isOpen,
  onClose,
  targetVacancy,
  availableVacancies = [],
  onSuccess,
}: ImportJobDescriptionModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed Form State
  const [parsedData, setParsedData] = useState<ParsedJobDescription | null>(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [minExp, setMinExp] = useState(3);
  const [jobSummary, setJobSummary] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [qualifications, setQualifications] = useState('');

  // Target Mode
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>(
    targetVacancy ? 'existing' : 'new',
  );
  const [selectedVacancyId, setSelectedVacancyId] = useState(targetVacancy?.id || '');

  // Master Data Toggles
  const [syncSkillsToMasterData, setSyncSkillsToMasterData] = useState(true);
  const [syncDepartmentToMasterData, setSyncDepartmentToMasterData] = useState(true);
  const [syncPositionToMasterData, setSyncPositionToMasterData] = useState(true);

  // Commit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setIsParsing(false);
    setParseError(null);
    setParsedData(null);
    setTitle('');
    setDepartment('');
    setLocation('');
    setMinExp(3);
    setJobSummary('');
    setSkills([]);
    setSkillInput('');
    setQualifications('');
    setSubmitError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);

    try {
      const parsed = await parseJobDescriptionFile(file);
      setParsedData(parsed);
      setTitle(parsed.title);
      setDepartment(parsed.department);
      setLocation(parsed.location);
      setMinExp(parsed.minExperienceYears);
      setJobSummary(parsed.jobSummary);
      setSkills(parsed.requiredSkills);
      setQualifications(parsed.qualifications);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse document. Please check file format.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (!skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      setSkills((prev) => [...prev, s]);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleCommit = async () => {
    if (!title.trim()) {
      setSubmitError('Please enter a position title.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Sync Skills to Master Data Catalog (if enabled)
      if (syncSkillsToMasterData && skills.length > 0) {
        try {
          const existingSkillsRes = await getApi<Array<{ name: string }>>('/master-data/catalog/skills');
          const existingNames = new Set(
            Array.isArray(existingSkillsRes)
              ? existingSkillsRes.map((item) => item.name.toLowerCase())
              : [],
          );
          const newSkillsToBatch = skills.filter((s) => !existingNames.has(s.toLowerCase()));

          if (newSkillsToBatch.length > 0) {
            await postApi('/master-data/catalog/skills/batch', {
              rows: newSkillsToBatch.map((name) => ({ name, status: 'Active' })),
            });
          }
        } catch {
          // Non-blocking: continue with vacancy update even if master data catalog batch warns
        }
      }

      // 2. Sync Department to Master Data Catalog (if enabled)
      if (syncDepartmentToMasterData && department.trim()) {
        try {
          await postApi('/master-data/catalog/departments/batch', {
            rows: [{ name: department.trim(), status: 'Active' }],
          });
        } catch {
          // Ignore if exists
        }
      }

      // 3. Sync Position to Master Data Positions (if enabled)
      if (syncPositionToMasterData) {
        try {
          await postApi('/positions', {
            title: title.trim(),
            description: jobSummary.trim(),
            metadata: {
              department: department.trim(),
              minExperienceYears: minExp,
              requiredSkills: skills,
            },
          });
        } catch {
          // Ignore if position code or title already exists
        }
      }

      // 4. Apply to Vacancy
      const targetId = targetVacancy?.id || (targetMode === 'existing' ? selectedVacancyId : null);

      if (targetId) {
        // Update existing vacancy
        await patchApi(`/vacancies/${targetId}`, {
          title: title.trim(),
          jobSummary: jobSummary.trim(),
          department: department.trim(),
          location: location.trim(),
          minExperienceYears: minExp,
          requiredSkills: skills,
          qualifications: qualifications.trim(),
        });

        onSuccess({
          vacancyId: targetId,
          updatedTitle: title.trim(),
          skillsCount: skills.length,
          isNewRequisition: false,
        });
      } else {
        // Create new requisition
        const newVac = await postApi<{ id: string }>('/vacancies', {
          title: title.trim(),
          jobSummary: jobSummary.trim(),
          department: department.trim(),
          location: location.trim(),
          minExperienceYears: minExp,
          requiredSkills: skills,
          qualifications: qualifications.trim(),
          approvedHeadcount: 1,
        });

        onSuccess({
          vacancyId: newVac?.id,
          updatedTitle: title.trim(),
          skillsCount: skills.length,
          isNewRequisition: true,
        });
      }

      handleClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to synchronize Job Description.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Job Description & Sync Master Data"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4 py-1">
        {/* Upload Zone */}
        {!parsedData && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-500 bg-cyan-50/20 dark:bg-cyan-950/20 rounded-2xl p-8 text-center cursor-pointer transition-all hover:shadow-md group space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon name="file-text" size={28} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Drop your Job Description (.docx, .pdf) here
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Compatible with standard SGH Job Specifications (e.g. HRIS Specialist, Charge Nurse)
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Icon name="upload" size={13} />
              <span>Browse file from computer</span>
            </div>
          </div>
        )}

        {/* Loading Spinner during document parsing */}
        {isParsing && (
          <div className="p-8 text-center space-y-2">
            <div className="inline-block w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Parsing sections, skills, and requirements from {selectedFile?.name}…
            </p>
          </div>
        )}

        {/* Parsing Error */}
        {parseError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>{parseError}</span>
            <button
              type="button"
              onClick={() => resetState()}
              className="text-xs font-bold underline cursor-pointer"
            >
              Try another file
            </button>
          </div>
        )}

        {/* Parsed Review Form */}
        {parsedData && !isParsing && (
          <div className="space-y-4 text-xs">
            {/* Source Document pill */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Icon name="check-circle" size={15} className="text-emerald-500" />
                <span className="font-bold">Extracted from:</span>
                <span className="font-mono text-[11px] text-slate-500">{selectedFile?.name}</span>
              </div>
              <button
                type="button"
                onClick={() => resetState()}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Change document
              </button>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {submitError}
              </div>
            )}

            {/* Target Requisition Selector */}
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-2">
              <label className="block text-xs font-bold text-blue-950 dark:text-blue-200">
                Target Requisition
              </label>

              {targetVacancy ? (
                <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>
                    Apply directly to current vacancy: <b>{targetVacancy.title}</b>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    {targetVacancy.status}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetMode === 'existing'}
                        onChange={() => setTargetMode('existing')}
                        className="text-blue-600"
                      />
                      <span>Apply to existing vacancy</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetMode === 'new'}
                        onChange={() => setTargetMode('new')}
                        className="text-blue-600"
                      />
                      <span>Create new requisition</span>
                    </label>
                  </div>

                  {targetMode === 'existing' && (
                    <Select
                      aria-label="Select target vacancy"
                      value={selectedVacancyId}
                      onChange={(e) => setSelectedVacancyId(e.target.value)}
                    >
                      <option value="">Select a vacancy to auto-fill...</option>
                      {availableVacancies.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} ({v.department || 'No dept'}) • {v.status}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Position Title & Department Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Position Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Location & Min Experience Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Work Location / Branch
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Min Experience (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={minExp}
                  onChange={(e) => setMinExp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Job Summary */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Job Summary &bull; Core Purpose
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Clears activation blocker
                </span>
              </div>
              <textarea
                rows={3}
                value={jobSummary}
                onChange={(e) => setJobSummary(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            {/* Skills & Knowledge Tag Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Required Clinical &amp; Technical Skills ({skills.length})
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Enables % Match scoring
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  placeholder="Add another skill and press Enter..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={!skillInput.trim()}
                  className="px-3 py-1.5 rounded-lg font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 min-h-[44px] items-center">
                {skills.length === 0 ? (
                  <span className="text-slate-400 italic">No skills extracted. Add skills above.</span>
                ) : (
                  skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
                        title={`Remove ${skill}`}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Master Data Auto-Sync Options */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Master Data Automation
              </span>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncSkillsToMasterData}
                    onChange={(e) => setSyncSkillsToMasterData(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Sync extracted skills to Master Data Skills catalog for reuse</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncDepartmentToMasterData}
                    onChange={(e) => setSyncDepartmentToMasterData(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Register department in Master Data if not already present</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncPositionToMasterData}
                    onChange={(e) => setSyncPositionToMasterData(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Update/Create standardized Position in Master Data Catalog</span>
                </label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCommit}
                disabled={isSubmitting || !title.trim() || (targetMode === 'existing' && !selectedVacancyId && !targetVacancy)}
                loading={isSubmitting}
                loadingLabel="Synchronizing..."
              >
                {targetVacancy || targetMode === 'existing'
                  ? 'Apply to Requisition & Sync Master Data'
                  : 'Create Requisition & Sync Master Data'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
