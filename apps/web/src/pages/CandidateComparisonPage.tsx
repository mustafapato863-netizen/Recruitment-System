import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

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
    role: 'Registered Nurse',
    avatarColor: 'bg-blue-600',
    matchScore: 92,
    matchGrade: 'High Match',
    skills: ['ICU', 'BLS/ACLS', 'IV Therapy', 'EMR'],
    experience: '5 years in Critical Care, 2 yrs Surg',
    education: 'BSN – Cairo University',
    ratings: {
      technical: 5,
      communication: 4,
      teamwork: 5,
    },
    recommendation: 'Keep in Pipeline',
  },
  {
    id: '2',
    name: 'Heba Salah',
    role: 'Registered Nurse',
    avatarColor: 'bg-emerald-600',
    matchScore: 78,
    matchGrade: 'Good Match',
    skills: ['Wound Care', 'BLS'],
    experience: '4 years in Medical Surgical, 1 year in ICU',
    education: 'BSN – Alexandria University',
    ratings: {
      technical: 4,
      communication: 5,
      teamwork: 4,
    },
    recommendation: 'Keep in Pipeline',
  },
  {
    id: '3',
    name: 'Lina Mostafa',
    role: 'Registered Nurse',
    avatarColor: 'bg-amber-600',
    matchScore: 63,
    matchGrade: 'Fair Match',
    skills: ['Pediatrics', 'BLS'],
    experience: '3 years in Pediatrics, 1 year ER',
    education: 'BSN – Cairo University',
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

  const handleRemove = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/candidates')}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Compare Candidates <span className="text-xs font-medium text-gray-400 font-normal">(Recruiter / Hiring Manager)</span>
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-6">
            Select up to 3 candidates to compare match scores, competency ratings, and clinical credentials side-by-side.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/candidates')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Icon name="plus" size={14} /> Add Candidate
          </button>
        </div>
      </div>

      {/* ── Main Comparison Grid & Summary Sidebar (Screen 11) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 3-Column Candidate Comparison Cards (9 cols) */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4">
          {candidates.map((c) => {
            const isTop = c.matchScore >= 90;
            const ringColor = isTop ? 'text-blue-600' : c.matchScore >= 75 ? 'text-emerald-500' : 'text-amber-500';

            return (
              <div
                key={c.id}
                className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs flex flex-col justify-between space-y-4 relative"
              >
                {/* Remove button */}
                <button
                  onClick={() => handleRemove(c.id)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1 text-xs cursor-pointer"
                >
                  ✕
                </button>

                {/* Header Profile */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full ${c.avatarColor} text-white font-bold text-sm flex items-center justify-center shrink-0`}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight">{c.name}</h3>
                    <p className="text-[11px] text-gray-500 font-medium">{c.role}</p>
                  </div>
                </div>

                {/* Circular Match Gauge */}
                <div className="py-2 flex items-center justify-center gap-3 bg-gray-50/70 rounded-lg border border-gray-100">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-gray-200" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
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
                    <span className="absolute text-[11px] font-extrabold text-gray-900 tnum">{c.matchScore}%</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">{c.matchScore}%</span>
                    <span className="text-[10px] font-semibold text-gray-500">{c.matchGrade}</span>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {c.skills.map((skill, idx) => (
                      <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Experience</span>
                  <p className="text-xs text-gray-700 font-medium leading-snug">{c.experience}</p>
                </div>

                {/* Education */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Education</span>
                  <p className="text-xs text-gray-700 font-medium">{c.education}</p>
                </div>

                {/* Interview Ratings Breakdown */}
                <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interview Ratings</span>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-[11px]">Technical</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.technical)}{'☆'.repeat(5 - c.ratings.technical)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-[11px]">Communication</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.communication)}{'☆'.repeat(5 - c.ratings.communication)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-[11px]">Teamwork</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.teamwork)}{'☆'.repeat(5 - c.ratings.teamwork)}</span>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase">Recommendation</span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {c.recommendation}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Comparison Summary (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-5">
          <h2 className="text-xs font-bold text-gray-900 pb-2 border-b border-gray-100">Comparison Summary</h2>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[11px] text-gray-400 font-medium block">Best Overall Match</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-gray-900">Nour Ali</span>
                <span className="font-extrabold text-blue-600 tnum">92%</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-gray-400 font-medium block">Best Technical Fit</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-gray-900">Nour Ali</span>
                <span className="font-extrabold text-blue-600 tnum">4.8 / 5</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-gray-400 font-medium block">Best Communication</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-gray-900">Heba Salah</span>
                <span className="font-extrabold text-blue-600 tnum">4.2 / 5</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/candidates')}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              View Full Profiles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
