import React from 'react';
import type { Vacancy } from '@recruitflow/contracts';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import type { ExtractedCandidate } from '../../utils/resumeParser';

interface CVMatchAssignerProps {
  profile: ExtractedCandidate;
  vacancies: Vacancy[];
  targetVacancy: string;
  setTargetVacancy: (v: string) => void;
  targetStage: string;
  setTargetStage: (s: string) => void;
  candidateSource: string;
  setCandidateSource: (s: string) => void;
  duplicateDecision: 'update' | 'new' | 'link';
  setDuplicateDecision: (d: 'update' | 'new' | 'link') => void;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export const CVMatchAssigner: React.FC<CVMatchAssignerProps> = ({
  profile,
  vacancies,
  targetVacancy,
  setTargetVacancy,
  targetStage,
  setTargetStage,
  candidateSource,
  setCandidateSource,
  duplicateDecision,
  setDuplicateDecision,
  submitting,
  onBack,
  onConfirm,
}) => {
  return (
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
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to Edit</span>
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
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

            {/* Side-by-Side Visual Diff Inspector */}
            <div className="mt-3 pt-3 border-t border-amber-200/80 dark:border-amber-900/50 grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/60">
                <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">
                  Existing Record (CMD-SGH-012)
                </span>
                <strong className="text-slate-800 dark:text-slate-200 block mt-0.5">
                  Dr. Tariq Al-Mansoor
                </strong>
                <span className="text-slate-500 dark:text-slate-400 block text-[10.5px]">
                  Specialist Cardiologist (SGH Jeddah • 2023)
                </span>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                  Historical Rating: 4.5/5.0
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase tracking-wider">
                  Newly Parsed CV (2026)
                </span>
                <strong className="text-slate-800 dark:text-slate-200 block mt-0.5">
                  {profile.firstName} {profile.lastName}
                </strong>
                <span className="text-emerald-700 dark:text-emerald-300 block text-[10.5px]">
                  {profile.title || 'Consultant Interventional Cardiologist'}
                </span>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                  +{profile.experienceYears || 3} Years Experience Added
                </span>
              </div>
            </div>
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
                {vacancies.length === 0 ? (
                  <option value="">Loading active requisitions...</option>
                ) : (
                  vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      [{v.vacancyCode}] {(v as any).position?.title || v.title || 'Requisition'} {v.branch?.name ? `(${v.branch.name})` : ''}
                    </option>
                  ))
                )}
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
  );
};
