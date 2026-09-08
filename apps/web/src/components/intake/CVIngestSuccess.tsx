import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Vacancy } from '@recruitflow/contracts';
import { Icon } from '../Icon';
import type { ExtractedCandidate } from '../../utils/resumeParser';

interface CVIngestSuccessProps {
  profile: ExtractedCandidate;
  vacancies?: Vacancy[];
  confirmedCandidateCode: string;
  confirmedCandidateId: string | null;
  confirmedAppId: string | null;
  targetVacancy: string;
  targetStage: string;
  candidateSource: string;
  onClearUpload: () => void;
  onShowToast: (msg: string) => void;
}

export const CVIngestSuccess: React.FC<CVIngestSuccessProps> = ({
  profile,
  vacancies,
  confirmedCandidateCode,
  confirmedCandidateId,
  confirmedAppId,
  targetVacancy,
  targetStage,
  candidateSource,
  onClearUpload,
  onShowToast,
}) => {
  const navigate = useNavigate();

  const targetVacancyName = React.useMemo(() => {
    if (!targetVacancy || targetVacancy === 'pool') return 'General Talent Pool';
    const found = vacancies?.find((v) => v.id === targetVacancy);
    if (found) {
      const title = found.position?.title || found.title || 'Requisition';
      return `[${found.vacancyCode}] ${title}`;
    }
    return targetVacancy;
  }, [targetVacancy, vacancies]);

  const copyConfirmedCode = async () => {
    try {
      await navigator.clipboard.writeText(confirmedCandidateCode);
      onShowToast(`✓ Candidate code copied: ${confirmedCandidateCode}`);
    } catch {
      onShowToast(`Candidate code: ${confirmedCandidateCode}`);
    }
  };

  return (
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
          The candidate record has been normalized and synced with the recruitment system.
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
                {profile.title || 'Role not specified'} &bull; {profile.currentCompany || 'Organization not reported'}
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
              onClick={() => void copyConfirmedCode()}
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
            <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate max-w-[240px]" title={targetVacancyName}>
              {targetVacancyName}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Source</span>
            <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{candidateSource}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block truncate">{profile.email || 'Not reported'}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block">{profile.phone || '—'}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Experience</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block">{profile.experienceYears === undefined ? 'Not reported' : `${profile.experienceYears} Years`}</span>
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
          onClick={() => navigate(confirmedCandidateId ? `/candidates/${confirmedCandidateId}` : '/candidates')}
          className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-purple-500/20 flex items-center justify-center gap-2"
        >
          <Icon name="user" size={14} />
          <span>View Candidate 360 Profile ↗</span>
        </button>

        {confirmedAppId && (
          <button
            type="button"
            onClick={() => navigate(`/applications/${confirmedAppId}`)}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            <Icon name="briefcase" size={14} />
            <span>View Application in Pipeline ↗</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate(targetVacancy && targetVacancy !== 'pool' ? `/applications?vacancyId=${targetVacancy}` : '/applications')}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
        >
          <Icon name="folder-kanban" size={14} />
          <span>Open Requisition Pipeline</span>
        </button>

        <button
          type="button"
          onClick={onClearUpload}
          className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
        >
          <Icon name="upload" size={14} />
          <span>Process Another Resume</span>
        </button>
      </div>
    </div>
  );
};
