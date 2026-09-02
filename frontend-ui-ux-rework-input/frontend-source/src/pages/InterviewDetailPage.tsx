import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Interview } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

interface CompetencyItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rating: number;
}

const defaultCompetencies: CompetencyItem[] = [
  {
    id: '1',
    name: 'Clinical Expertise & Protocols',
    desc: 'Knowledge of hospital protocols, emergency response, and patient care standards.',
    icon: 'activity',
    rating: 5,
  },
  {
    id: '2',
    name: 'Communication & Interpersonal Skills',
    desc: 'Clarity with patients, empathy, active listening, and cross-functional team collaboration.',
    icon: 'message-square',
    rating: 4,
  },
  {
    id: '3',
    name: 'Problem Solving & Critical Thinking',
    desc: 'Handling complex clinical situations, prioritization under pressure, and decision making.',
    icon: 'sparkles',
    rating: 5,
  },
  {
    id: '4',
    name: 'Cultural Fit & Team Dynamics',
    desc: 'Alignment with Saudi German Health values, teamwork, adaptability, and patient-first mindset.',
    icon: 'users',
    rating: 4,
  },
  {
    id: '5',
    name: 'Technical Competence & Tools',
    desc: 'Proficiency with EHR systems, medical equipment, and healthcare documentation.',
    icon: 'file-text',
    rating: 5,
  },
  {
    id: '6',
    name: 'Leadership & Initiative',
    desc: 'Ownership of duties, proactive approach to patient safety, and peer support.',
    icon: 'star',
    rating: 4,
  },
];

export function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);

  // Scorecard State (Panel 13 exact competencies)
  const [competencies, setCompetencies] = useState<CompetencyItem[]>(defaultCompetencies);

  // Recommendation & notes state
  const [recommendation, setRecommendation] = useState<'strong-hire' | 'hire' | 'hold' | 'no-hire'>('strong-hire');
  const [strengths, setStrengths] = useState(
    'Demonstrated strong clinical knowledge, excellent patient care ethic, and familiarity with Joint Commission standards.'
  );
  const [concerns, setConcerns] = useState('May need brief orientation with our localized HIS software modules.');
  const [additionalNotes, setAdditionalNotes] = useState('Recommended for expedited onboarding given high department demand.');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const res = await getApi<Interview>(`/interviews/${id}`);
        if (res) {
          setInterview(res);
          if (res.scorecards && res.scorecards.length > 0) {
            const sc = res.scorecards[0];
            if (sc.strengths) setStrengths(sc.strengths);
            if (sc.concerns) setConcerns(sc.concerns);
            if (sc.notes) setAdditionalNotes(sc.notes);
          }
        }
      } catch (err) {
        console.error('Failed to load interview', err);
      }
    }
    void loadData();
  }, [id]);

  const candidateName = interview?.candidateName || 'Nour Ali';
  const jobTitle = interview?.positionTitle || 'Registered Nurse';
  const applicantCode = interview?.applicationCode || 'APP-100184';
  const interviewDateTime = interview?.scheduledStart
    ? new Date(interview.scheduledStart).toLocaleString()
    : 'May 7, 2024 • 10:00 AM';
  const interviewStage = interview?.interviewType || 'Clinical Interview';
  const leadInterviewer = interview?.attendees?.[0]?.userName || 'Omar Hassan (Hiring Manager)';
  const panelists = interview?.attendees?.slice(1) || [
    { userName: 'Sara Ahmed', role: 'Staff Nurse' },
    { userName: 'Yousef Hamdy', role: 'HR Business Partner' },
  ];

  const handleRatingChange = (compId: string, star: number) => {
    setCompetencies((prev) =>
      prev.map((c) => (c.id === compId ? { ...c, rating: star } : c))
    );
  };

  const totalScore = competencies.reduce((sum, c) => sum + c.rating, 0);
  const avgScore = (totalScore / competencies.length).toFixed(1);
  const avgPercentage = Math.round((parseFloat(avgScore) / 5) * 100);

  const handleSubmitScorecard = async () => {
    if (id) {
      try {
        await postApi(`/interviews/${id}/scorecards`, {
          overallRating: parseFloat(avgScore),
          recommendation: recommendation === 'strong-hire' ? 'Strong Hire' : recommendation === 'hire' ? 'Hire' : recommendation === 'hold' ? 'Neutral' : 'No Hire',
          strengths,
          concerns,
          notes: additionalNotes,
        });
      } catch {
        // safe fallback
      }
    }
    navigate('/interviews');
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-5">
      {/* ── Top Back Button ── */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/interviews')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
        >
          &larr; Back to Interviews
        </button>
      </div>

      {/* ── Candidate Banner (Panel 13) ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs ring-4 ring-blue-50">
            NA
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 tracking-tight">{candidateName}</h1>
            <p className="text-xs font-semibold text-gray-500">{jobTitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs md:border-l md:border-gray-200/80 md:pl-6">
          <div>
            <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1 mb-1">
              <Icon name="file-text" size={12} /> Applicant ID
            </span>
            <span className="font-extrabold text-gray-900 font-mono text-xs">{applicantCode}</span>
          </div>

          <div>
            <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1 mb-1">
              <Icon name="clock" size={12} /> Current Stage
            </span>
            <span className="font-bold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Interview
            </span>
          </div>

          <div>
            <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1 mb-1">
              <Icon name="calendar" size={12} /> Application Date
            </span>
            <span className="font-bold text-gray-900">May 7, 2024</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/candidates/1')}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            View Candidate Profile &gt;
          </button>
        </div>
      </div>

      {/* ── Interview Details Card (Panel 13) ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-extrabold text-gray-900 tracking-tight">Interview Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs pt-1">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interview Date &amp; Time</span>
            <div className="flex items-center gap-1.5 text-gray-900 font-bold">
              <Icon name="calendar" size={13} className="text-gray-400" />
              <span>{interviewDateTime}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interview Stage</span>
            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{interviewStage}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interviewer / Panel Lead</span>
            <div className="flex items-center gap-1.5 text-gray-900 font-bold">
              <Icon name="user" size={13} className="text-gray-400" />
              <span>{leadInterviewer}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Location / Type</span>
            <div className="flex items-center gap-1.5 text-gray-900 font-bold">
              <Icon name="video" size={13} className="text-gray-400" />
              <span>Zoom Video Call</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Other Panelists</span>
            <div className="text-gray-900 font-bold space-y-0.5">
              {panelists.map((p, idx) => (
                <div key={idx} className="truncate">
                  {p.userName} {p.role && <span className="font-normal text-gray-500">({p.role})</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Scorecard (Left) & Recommendation / Gauge (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Evaluation Scorecard & Textareas (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Evaluation Scorecard Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Evaluation Scorecard</h3>
              <p className="text-xs text-gray-500 mt-0.5">Rate the candidate on each competency from 1 to 5</p>
            </div>

            <div className="divide-y divide-gray-100">
              {competencies.map((comp) => (
                <div key={comp.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon name={comp.icon as any} size={15} className="text-blue-600 shrink-0" />
                      <h4 className="text-xs font-bold text-gray-900">{comp.name}</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 pl-6 leading-relaxed">{comp.desc}</p>
                  </div>

                  {/* 5-Star Selector (Blue Filled Stars) */}
                  <div className="flex items-center gap-1.5 pl-6 sm:pl-0 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingChange(comp.id, star)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                          star <= comp.rating
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={`${star} star`}
                      >
                        <Icon name="star" size={14} />
                      </button>
                    ))}
                    <span className="text-xs font-extrabold text-blue-700 ml-2 w-7 text-right">
                      {comp.rating}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Structured Feedback Textareas */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-5">
            {/* Strengths */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <span>Strengths</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                    Recommended
                  </span>
                </label>
                <span className="text-[10px] text-gray-400">{strengths.length}/500</span>
              </div>
              <textarea
                rows={3}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                maxLength={500}
                placeholder="What did the candidate do well? Key highlights, technical depth, relevant experience..."
                className="w-full p-3 text-xs bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:bg-white transition leading-relaxed"
              />
            </div>

            {/* Concerns / Areas of Development */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-900">Concerns / Areas of Development</label>
                <span className="text-[10px] text-gray-400">{concerns.length}/500</span>
              </div>
              <textarea
                rows={3}
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                maxLength={500}
                placeholder="Any gaps in experience, potential red flags, skill areas requiring training or support..."
                className="w-full p-3 text-xs bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:bg-white transition leading-relaxed"
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-900">Additional Notes / Comments</label>
                <span className="text-[10px] text-gray-400">{additionalNotes.length}/500</span>
              </div>
              <textarea
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                maxLength={500}
                placeholder="Salary expectations discussed, notice period, availability, specific questions for next round..."
                className="w-full p-3 text-xs bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:bg-white transition leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Score Gauge & Recommendation Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Overall Average Score Card with Circular SVG Gauge */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs text-center space-y-3">
            <h3 className="text-xs font-extrabold text-gray-900 tracking-tight">Overall Score</h3>

            {/* Circular Gauge */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#2563eb"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * avgPercentage) / 100}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-gray-900 tracking-tight">{avgScore}</span>
                <span className="text-[10px] text-gray-400 font-semibold">out of 5.0</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {parseFloat(avgScore) >= 4.0 ? 'Excellent' : parseFloat(avgScore) >= 3.0 ? 'Good' : 'Needs Review'}
              </span>
            </div>

            <p className="text-[11px] text-gray-500">Based on 6 evaluated competencies</p>
          </div>

          {/* Recommendation Decision Radio Cards */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-3">
            <div>
              <h3 className="text-xs font-extrabold text-gray-900">Recommendation</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Your final hiring recommendation</p>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'strong-hire',
                  label: 'Strong Hire',
                  desc: 'Exceptional candidate, exceeds requirements',
                  activeBorder: 'border-emerald-600 bg-emerald-50/40 text-emerald-950',
                  badge: 'bg-emerald-600 text-white',
                },
                {
                  id: 'hire',
                  label: 'Hire',
                  desc: 'Solid candidate, meets all requirements',
                  activeBorder: 'border-blue-600 bg-blue-50/40 text-blue-950',
                  badge: 'bg-blue-600 text-white',
                },
                {
                  id: 'hold',
                  label: 'Hold',
                  desc: 'Needs further evaluation or compare with others',
                  activeBorder: 'border-amber-600 bg-amber-50/40 text-amber-950',
                  badge: 'bg-amber-600 text-white',
                },
                {
                  id: 'no-hire',
                  label: 'No Hire',
                  desc: 'Does not meet requirements for this role',
                  activeBorder: 'border-rose-600 bg-rose-50/40 text-rose-950',
                  badge: 'bg-rose-600 text-white',
                },
              ].map((opt) => {
                const isSelected = recommendation === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setRecommendation(opt.id as any)}
                    className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected ? opt.activeBorder : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-xs block text-gray-900">{opt.label}</span>
                      <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                        isSelected ? `${opt.badge} border-transparent font-bold text-[10px]` : 'border-gray-300'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Evaluation Status & Last Saved */}
            <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Icon name="file" size={12} /> Evaluation Status
                </span>
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Draft
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Icon name="clock" size={12} /> Last Saved
                </span>
                <span className="font-semibold text-gray-700">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Bottom Action Bar (Panel 13) ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/interviews')}
            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSaved(true)}
            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {isSaved ? '✓ Draft Saved' : 'Save Draft'}
          </button>

          <div className="relative group">
            <button
              type="button"
              onClick={handleSubmitScorecard}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              Submit Evaluation
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-right flex items-center justify-end gap-1">
        <span>🔒</span> You can review before final submission
      </p>
    </div>
  );
}
