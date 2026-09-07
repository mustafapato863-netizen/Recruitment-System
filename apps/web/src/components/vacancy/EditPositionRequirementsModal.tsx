import { useState, useEffect, type KeyboardEvent } from 'react';
import { patchApi } from '../../api/client';
import { Icon } from '../Icon';
import { Modal } from '../Modal';

interface EditPositionRequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacancyId: string;
  positionTitle: string;
  positionCode?: string;
  initialSkills?: string[];
  initialMinExp?: number | null;
  initialLocation?: string;
  initialDepartment?: string;
  initialQualifications?: string | null;
  initialJobSummary?: string | null;
  onSaved: (updated: {
    requiredSkills: string[];
    minExperienceYears: number | null;
    location: string;
    department: string;
    qualifications?: string | null;
    jobSummary?: string | null;
  }) => void;
}

const COMMON_HEALTHCARE_SKILLS = [
  'Critical Care',
  'Patient Assessment',
  'BLS',
  'ACLS',
  'SCFHS',
  'EHR',
  'Medication Administration',
  'IV Therapy',
  'Interventional Cardiology',
  'Pharmacotherapy',
  'ICD-10-AM',
  'CT Scan',
  'MRI Operation',
  'TypeScript',
  'Clinical Leadership',
];

export function EditPositionRequirementsModal({
  isOpen,
  onClose,
  vacancyId,
  positionTitle,
  positionCode,
  initialSkills = [],
  initialMinExp = 3,
  initialLocation = 'SGH Riyadh Hospital',
  initialDepartment = 'Clinical Services',
  initialQualifications = '',
  initialJobSummary = '',
  onSaved,
}: EditPositionRequirementsModalProps) {
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [skillInput, setSkillInput] = useState('');
  const [minExp, setMinExp] = useState<number>(initialMinExp ?? 3);
  const [location, setLocation] = useState(initialLocation);
  const [department, setDepartment] = useState(initialDepartment);
  const [qualifications, setQualifications] = useState(initialQualifications ?? '');
  const [jobSummary, setJobSummary] = useState(initialJobSummary ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSkills(initialSkills || []);
      setMinExp(initialMinExp ?? 3);
      setLocation(initialLocation || 'SGH Riyadh Hospital');
      setDepartment(initialDepartment || 'Clinical Services');
      setQualifications(initialQualifications ?? '');
      setJobSummary(initialJobSummary ?? '');
      setError(null);
      setSkillInput('');
    }
  }, [isOpen, initialSkills, initialMinExp, initialLocation, initialDepartment, initialQualifications, initialJobSummary]);

  const handleAddSkill = (skillToAdd?: string) => {
    const s = (skillToAdd || skillInput).trim();
    if (!s) return;
    if (!skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      setSkills((prev) => [...prev, s]);
    }
    setSkillInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await patchApi(`/vacancies/${vacancyId}`, {
        requiredSkills: skills,
        minExperienceYears: minExp,
        location,
        department,
        qualifications,
        jobSummary,
      });

      onSaved({
        requiredSkills: skills,
        minExperienceYears: minExp,
        location,
        department,
        qualifications,
        jobSummary,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save position requirements.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Position Requirements & Benchmark Specs"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5 py-2">
        {/* Position Context Header */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Icon name="briefcase" size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {positionTitle}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {positionCode ? `${positionCode} • ` : ''}Requirements drive the empirical % Fit Score in Screening & Bench
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Active Catalog
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900/60">
            {error}
          </div>
        )}

        {/* Skills Tag Management */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Required Clinical &amp; Technical Skills ({skills.length})
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a skill and press Enter (e.g. ICU, Echocardiography, ACLS)"
              className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="button"
              onClick={() => handleAddSkill()}
              disabled={!skillInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Add Skill
            </button>
          </div>

          {/* Active Skills Chips */}
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 min-h-[50px] items-center">
            {skills.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No skills configured yet. Add skills to enable % match scoring.</span>
            ) : (
              skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-slate-400 hover:text-rose-500 transition"
                    title={`Remove ${skill}`}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Suggested Skills Chips */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">Quick add common healthcare skills:</span>
            <div className="flex flex-wrap gap-1">
              {COMMON_HEALTHCARE_SKILLS.filter(
                (s) => !skills.some((existing) => existing.toLowerCase() === s.toLowerCase())
              ).slice(0, 8).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleAddSkill(suggestion)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-teal-50 dark:bg-slate-800/80 dark:hover:bg-teal-950/40 text-slate-600 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-300 border border-slate-200/80 dark:border-slate-700/60 transition"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Experience & Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Min Experience (Years)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="30"
                value={minExp}
                onChange={(e) => setMinExp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="absolute right-3.5 top-2 text-xs font-semibold text-slate-400">
                Years required
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Hospital Branch / Location
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="SGH Riyadh Hospital">SGH Riyadh Hospital (KSA)</option>
              <option value="SGH Jeddah Clinic">SGH Jeddah Clinic (KSA)</option>
              <option value="SGH Dammam Hospital">SGH Dammam Hospital (KSA)</option>
              <option value="Dubai Medical Center">Dubai Medical Center (UAE)</option>
              <option value="Ajman Specialty Clinic">Ajman Specialty Clinic (UAE)</option>
            </select>
          </div>
        </div>

        {/* Department & Qualifications */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Department / Clinical Specialty
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Cardiology, Inpatient Nursing, Pharmacy, Surgery"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Licensure, Certifications &amp; Qualifications
            </label>
            <textarea
              rows={2}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="e.g. Valid SCFHS Consultant/Specialist License; active BLS and ACLS certifications; accredited Medical Board."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving to DB...</span>
              </>
            ) : (
              <>
                <Icon name="check" size={14} />
                <span>Save Requirements</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
