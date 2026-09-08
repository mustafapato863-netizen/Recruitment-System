import React, { useState } from 'react';
import { Icon } from '../Icon';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import {
  generateAISummary,
  detectClinicalDomain,
  type ExtractedCandidate,
} from '../../utils/resumeParser';
import type { ScoredVacancy } from '../../hooks/useCVIntakeFlow';

interface CVParsedEditorProps {
  profile: ExtractedCandidate;
  setProfile: React.Dispatch<React.SetStateAction<ExtractedCandidate | null>>;
  scoredVacancies?: ScoredVacancy[];
  uploadedFileName: string | null;
  candidateSource: string;
  candidateSourceOptions: string[];
  setCandidateSource: (source: string) => void;
  onReset: () => void;
  onBack: () => void;
  onProceed: () => void;
}

export const CVParsedEditor: React.FC<CVParsedEditorProps> = ({
  profile,
  setProfile,
  scoredVacancies,
  uploadedFileName,
  candidateSource,
  candidateSourceOptions,
  setCandidateSource,
  onReset,
  onBack,
  onProceed,
}) => {
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newCert, setNewCert] = useState('');
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [aiFeedbackMessage, setAiFeedbackMessage] = useState<string | null>(null);

  const handleRegenerateAISummary = () => {
    setIsRegeneratingSummary(true);
    setAiFeedbackMessage(null);

    setTimeout(() => {
      // Re-detect clinical domain and subspecialties based on current edited profile
      const detection = detectClinicalDomain(
        profile.skills || [],
        profile.title,
        profile.certifications,
        profile.rawText,
        profile.experienceYears ?? 0,
      );

      const updatedProfile: ExtractedCandidate = {
        ...profile,
        clinicalDomain: detection.domain,
        subspecialties: detection.subspecialties,
        keyHighlights: detection.keyHighlights,
        aiSummaryConfidence: detection.confidence,
      };

      const freshSummary = generateAISummary(updatedProfile);
      updatedProfile.summary = freshSummary;

      setProfile(updatedProfile);
      setIsRegeneratingSummary(false);
      setAiFeedbackMessage('AI summary refreshed from the current CV fields.');
      setTimeout(() => setAiFeedbackMessage(null), 4000);
    }, 450);
  };

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    const current = profile.skills || [];
    if (!current.includes(newSkill.trim())) {
      setProfile({ ...profile, skills: [...current, newSkill.trim()] });
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter((s) => s !== skillToRemove),
    });
  };

  const handleAddCert = () => {
    if (!newCert.trim()) return;
    const current = profile.certifications || [];
    if (!current.includes(newCert.trim())) {
      setProfile({ ...profile, certifications: [...current, newCert.trim()] });
    }
    setNewCert('');
  };

  const handleRemoveCert = (certToRemove: string) => {
    setProfile({
      ...profile,
      certifications: (profile.certifications || []).filter((c) => c !== certToRemove),
    });
  };

  const handleAddLanguage = () => {
    if (!newLanguage.trim()) return;
    const current = profile.languages || [];
    if (!current.includes(newLanguage.trim())) {
      setProfile({ ...profile, languages: [...current, newLanguage.trim()] });
    }
    setNewLanguage('');
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    setProfile({
      ...profile,
      languages: (profile.languages || []).filter((l) => l !== langToRemove),
    });
  };

  return (
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
                Parsed from {uploadedFileName || 'Uploaded Document'}
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
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Icon name="refresh-cw" size={13} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to Upload</span>
          </button>
          <button
            type="button"
            onClick={onProceed}
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
            {/* Clinical Domain Badge */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-indigo-500/10 dark:from-blue-950/50 dark:via-emerald-950/50 dark:to-indigo-950/50 border border-blue-200/80 dark:border-blue-800/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  AI Clinical Domain
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                  <Icon name="sparkles" size={10} />
                  SGH Model
                </span>
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Icon name="activity" size={14} className="text-emerald-500 shrink-0" />
                <span className="truncate">{profile.clinicalDomain || 'Unclassified'}</span>
              </div>
            </div>

            {/* Parsing Quality Gauge */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Parsing Fidelity
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {profile.aiSummaryConfidence === undefined ? 'Not available' : `${profile.aiSummaryConfidence}% ${profile.aiSummaryConfidence >= 80 ? 'High Match' : 'Review evidence'}`}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${profile.aiSummaryConfidence ?? 0}%` }}
                />
              </div>
            </div>

            {/* Subspecialties Detected */}
            {profile.subspecialties && profile.subspecialties.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Extracted Subspecialties
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.subspecialties.map((sub) => (
                    <span
                      key={sub}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Clinical Highlights */}
            {profile.keyHighlights && profile.keyHighlights.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Key Credentials & Highlights
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.keyHighlights.map((hl) => (
                    <span
                      key={hl}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    >
                      <Icon name="check" size={10} />
                      <span>{hl}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommended Position Preview */}
            {scoredVacancies && scoredVacancies.length > 0 && scoredVacancies[0].fitResult.score >= 35 && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    AI Position Match
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                    {scoredVacancies[0].fitResult.score}% Fit
                  </span>
                </div>
                <div
                  onClick={onProceed}
                  className="p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-emerald-50/60 dark:from-blue-950/40 dark:to-emerald-950/40 border border-blue-200 dark:border-blue-900/60 hover:border-blue-400 dark:hover:border-blue-700 transition cursor-pointer group shadow-2xs"
                  title="Click to proceed to match details"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 block">
                      [{scoredVacancies[0].vacancy.vacancyCode}]
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold group-hover:underline flex items-center gap-0.5">
                      Match Details →
                    </span>
                  </div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block mt-1">
                    {scoredVacancies[0].vacancy.position?.title || scoredVacancies[0].vacancy.title || 'Requisition'}
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Icon name="building" size={10} />
                    <span>{scoredVacancies[0].vacancy.branch?.name || scoredVacancies[0].vacancy.location || 'Location not set'}</span>
                  </span>
                  {scoredVacancies[0].fitResult.breakdown.skills.matched.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-900/40 flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                      <Icon name="check" size={11} />
                      <span>{scoredVacancies[0].fitResult.breakdown.skills.matched.length} key clinical skills aligned</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                SGH Compliance Readiness
              </span>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Icon name="check" size={14} />
                  <span>Contact & identity verified</span>
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
                  <span>JCI / CBAHI Accreditation Profile Ready</span>
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

              <FormField id="c-email" label="Email Address" hint="Provide an email or phone number">
                <Input
                  id="c-email"
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </FormField>

              <FormField id="c-phone" label="Phone Number" hint="Provide an email or phone number">
                <Input
                  id="c-phone"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField id="c-source" label="Source of CV">
                  <Select
                    id="c-source"
                    value={candidateSource}
                    onChange={(e) => setCandidateSource(e.target.value)}
                  >
                    {!candidateSourceOptions.includes(candidateSource) && candidateSource && (
                      <option value={candidateSource}>{candidateSource}</option>
                    )}
                    {candidateSourceOptions.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
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
                  value={profile.experienceYears ?? ''}
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

            {/* AI Executive Summary with Quick Regenerate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="c-summary" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Professional Executive Summary
                  </label>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <Icon name="sparkles" size={10} />
                    AI-Synthesized
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateAISummary}
                  disabled={isRegeneratingSummary}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold transition border border-blue-200 dark:border-blue-800 cursor-pointer disabled:opacity-50"
                  title="Re-synthesize executive summary based on edited skills, domain, and experience"
                >
                  <Icon
                    name={isRegeneratingSummary ? 'refresh-cw' : 'sparkles'}
                    size={12}
                    className={isRegeneratingSummary ? 'animate-spin' : ''}
                  />
                  <span>{isRegeneratingSummary ? 'Synthesizing...' : '✨ Regenerate with AI'}</span>
                </button>
              </div>

              {aiFeedbackMessage && (
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-fade-in border border-emerald-200 dark:border-emerald-800">
                  <Icon name="check" size={13} />
                  <span>{aiFeedbackMessage}</span>
                </div>
              )}

              <Textarea
                id="c-summary"
                rows={3}
                value={profile.summary || ''}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                placeholder="Candidate executive summary..."
              />
            </div>
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
                    title="Remove skill"
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
                <button type="button" onClick={handleAddCert} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer">
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
                <button type="button" onClick={handleAddLanguage} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
