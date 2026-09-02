import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

interface ComparisonCandidate {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  matchScore: number;
  matchGrade: string;
  skills: string[];
  experience: string;
  education: string;
  ratings: {
    technical: number;
    communication: number;
    teamwork: number;
  };
  recommendation: string;
}

const mockCandidates: ComparisonCandidate[] = [
  {
    id: '1',
    name: 'Nour Ali',
    role: 'Registered Nurse (ICU)',
    avatarColor: 'bg-blue-600 text-white',
    matchScore: 92,
    matchGrade: 'High Match',
    skills: ['Critical Care', 'BLS / ACLS', 'Hemodynamic Monitoring', 'EMR Systems'],
    experience: '5 years in Critical Care Unit, 2 yrs Surgery',
    education: 'BSN – Cairo University (Honor Graduate)',
    ratings: {
      technical: 5,
      communication: 4,
      teamwork: 5,
    },
    recommendation: 'Proceed to Offer',
  },
  {
    id: '2',
    name: 'Heba Salah',
    role: 'Registered Nurse (ICU)',
    avatarColor: 'bg-emerald-600 text-white',
    matchScore: 84,
    matchGrade: 'Good Match',
    skills: ['Wound Care', 'BLS', 'Ventilator Management', 'Infection Control'],
    experience: '4 years Medical Surgical, 2 years ICU',
    education: 'BSN – Alexandria University',
    ratings: {
      technical: 4,
      communication: 5,
      teamwork: 4,
    },
    recommendation: 'Keep in Shortlist',
  },
  {
    id: '3',
    name: 'Lina Mostafa',
    role: 'Registered Nurse (Pediatrics)',
    avatarColor: 'bg-purple-600 text-white',
    matchScore: 71,
    matchGrade: 'Fair Match',
    skills: ['Pediatrics', 'BLS', 'Patient Triage', 'IV Cannulation'],
    experience: '3 years in Pediatrics, 1 year Emergency',
    education: 'BSN – Ain Shams University',
    ratings: {
      technical: 3,
      communication: 4,
      teamwork: 4,
    },
    recommendation: 'Keep in Pipeline',
  },
];

export function CandidateComparisonPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<ComparisonCandidate[]>(mockCandidates);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleRemove = (id: string) => {
    if (candidates.length <= 1) {
      showToast('At least one candidate must remain in the comparison matrix.');
      return;
    }
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Toast Feedback ── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Talent Operations</span>
            <span>&bull;</span>
            <span className="text-blue-600 dark:text-blue-400">Decision Matrix</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => navigate('/candidates')}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Compare Candidates
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-9">
            Side-by-side evaluation of competency ratings, match algorithms, and clinical credentials to finalize hiring decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/candidates')}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Icon name="users" size={14} />
            <span>Candidate Directory</span>
          </button>
          <button
            type="button"
            onClick={() => showToast('Select additional candidates from the directory to add them to this comparison.')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shadow-blue-500/20"
          >
            <Icon name="plus" size={14} />
            <span>Add Candidate</span>
          </button>
        </div>
      </div>

      {/* ── Main Comparison Grid & Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Candidate Comparison Columns */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4">
          {candidates.map((c) => {
            const isTop = c.matchScore >= 90;
            const ringColor = isTop ? 'text-blue-600' : c.matchScore >= 75 ? 'text-emerald-500' : 'text-amber-500';

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4 relative"
              >
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  title="Remove from comparison"
                  className="absolute top-3.5 right-3.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 text-xs cursor-pointer transition"
                >
                  ✕
                </button>

                {/* Header Profile */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl ${c.avatarColor} font-black text-sm flex items-center justify-center shrink-0 shadow-xs`}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 pr-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{c.name}</h3>
                    <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{c.role}</p>
                  </div>
                </div>

                {/* Circular Match Gauge */}
                <div className="py-2.5 px-3 flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-200 dark:text-slate-700" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path
                        className={ringColor}
                        strokeDasharray={`${c.matchScore}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[11px] font-black text-slate-900 dark:text-white">{c.matchScore}%</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{c.matchScore}% Match</span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{c.matchGrade}</span>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Key Competencies</span>
                  <div className="flex flex-wrap gap-1">
                    {c.skills.map((skill, idx) => (
                      <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Clinical Background</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">{c.experience}</p>
                </div>

                {/* Education */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Degrees & Academics</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{c.education}</p>
                </div>

                {/* Interview Ratings Breakdown */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Scorecard Ratings</span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Technical Competence</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.technical)}{'☆'.repeat(5 - c.ratings.technical)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Communication & Bedside</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.communication)}{'☆'.repeat(5 - c.ratings.communication)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Team Collaboration</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.teamwork)}{'☆'.repeat(5 - c.ratings.teamwork)}</span>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Recommendation</span>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {c.recommendation}
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      showToast(`✓ Selected ${c.name} to advance to Offer Creation!`);
                      setTimeout(() => navigate('/offers/create'), 1200);
                    }}
                    className="w-full py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center"
                  >
                    Select & Create Offer
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Comparison Summary (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Hiring Team Recommendation
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Best Overall Match</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-slate-900 dark:text-white">Nour Ali</span>
                <span className="font-black text-blue-600 dark:text-blue-400">92%</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Highest Clinical Score</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-slate-900 dark:text-white">Nour Ali</span>
                <span className="font-black text-blue-600 dark:text-blue-400">4.8 / 5</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Highest Communication Score</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-slate-900 dark:text-white">Heba Salah</span>
                <span className="font-black text-blue-600 dark:text-blue-400">4.5 / 5</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => {
                showToast('✓ Advanced Nour Ali to formal employment offer generation.');
                setTimeout(() => navigate('/offers/create'), 1000);
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Advance Top Candidate (Nour Ali)
            </button>
            <button
              type="button"
              onClick={() => navigate('/candidates')}
              className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Back to Candidates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateComparisonPage;
