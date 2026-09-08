import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Candidate, Application, Vacancy, PaginatedResult } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { ComparisonMatrixCard, type ComparisonCandidate } from '../components/candidate/ComparisonMatrixCard';
import { QuickGuideTrigger } from '../quickguide';
import { calculateCandidateFitScore } from '@recruitflow/validation';
import './PageEnhancementsV2.css';

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-teal-600 text-white',
  'bg-amber-600 text-white',
  'bg-indigo-600 text-white',
];

export function CandidateComparisonPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryVacancyId = searchParams.get('vacancyId') || '';
  const queryIds = searchParams.get('ids') || '';

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(queryVacancyId);
  const [candidates, setCandidates] = useState<ComparisonCandidate[]>([]);
  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // ── 1. Fetch live vacancies for the position switcher ──
  useEffect(() => {
    const fetchVacancies = async () => {
      try {
        const list = await getApi<Vacancy[]>('/vacancies');
        if (Array.isArray(list)) {
          setVacancies(list);
        }
      } catch {
        // Ignore fallback
      }
    };
    void fetchVacancies();
  }, []);

  // ── 2. Load comparison data dynamically based on vacancyId or ids ──
  const loadComparisonData = useCallback(async () => {
    setIsLoading(true);
    try {
      const selectedVacancy = vacancies.find((vacancy) => vacancy.id === selectedVacancyId);
      if (selectedVacancyId) {
        // Load applicants for selected position
        const appRes = await getApi<PaginatedResult<Application>>(
          `/applications?vacancyId=${selectedVacancyId}&page=1&pageSize=50`
        );
        const apps = appRes?.data || [];

        if (apps.length > 0) {
          const mapped: ComparisonCandidate[] = apps.slice(0, 4).map((app, idx) => {
            const cand = app.candidate;
            const name = cand ? `${cand.firstName} ${cand.lastName}` : 'Candidate';
            const skills = cand?.skills || [];
            const expYears = cand?.experienceYears ?? 0;
            const fitResult = calculateCandidateFitScore(
              { skills, experienceYears: expYears, location: cand?.location, certifications: cand?.certifications, currentTitle: cand?.currentTitle },
              { requiredSkills: selectedVacancy?.requiredSkills || [], minExperienceYears: selectedVacancy?.minExperienceYears || 0, location: selectedVacancy?.location || selectedVacancy?.branch?.name || '', qualifications: selectedVacancy?.qualifications || '', department: selectedVacancy?.department || '' },
            );
            const score = fitResult.score;
            
            return {
              id: cand?.id || app.candidateId || `app-${app.id}`,
              applicationId: app.id,
              candidateCode: cand?.candidateCode,
              name,
              role: cand?.currentTitle || app.positionTitle || 'Applicant',
              avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
              matchScore: score,
              matchGrade: score >= 90 ? 'High Match' : score >= 80 ? 'Good Match' : 'Fair Match',
              skills,
              experience: `${expYears} years in ${cand?.currentTitle || 'Healthcare'}, Clinical Unit`,
              education: (cand as (Candidate & { education?: string | null }) | undefined)?.education || '',
              stage: app.stage,
              ratings: {
                technical: 0,
                communication: 0,
                teamwork: 0,
              },
              recommendation: app.stage,
            };
          });
          setCandidates(mapped);
          setIsLoading(false);
          return;
        }
      }

      if (queryIds) {
        // Load specific candidates by IDs
        const idsList = queryIds.split(',').map((s) => s.trim()).filter(Boolean);
        if (idsList.length > 0) {
          const results = await Promise.allSettled(
            idsList.map((id) => getApi<Candidate>(`/candidates/${id}`))
          );
          const loadedCands = results
            .filter((r): r is PromiseFulfilledResult<Candidate> => r.status === 'fulfilled' && Boolean(r.value))
            .map((r) => r.value);

          if (loadedCands.length > 0) {
            const mapped: ComparisonCandidate[] = loadedCands.map((cand, idx) => {
              const name = `${cand.firstName} ${cand.lastName}`;
              const skills = cand.skills || [];
              const expYears = cand.experienceYears ?? 0;
              const score = 0;

              return {
                id: cand.id,
                candidateCode: cand.candidateCode,
                name,
                role: cand.currentTitle || '',
                avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                matchScore: score,
                matchGrade: score >= 90 ? 'High Match' : score >= 80 ? 'Good Match' : 'Fair Match',
                skills,
                experience: expYears > 0 ? `${expYears} years in ${cand.currentCompany || ''}` : '',
                education: (cand as Candidate & { education?: string | null }).education || '',
                ratings: { technical: 0, communication: 0, teamwork: 0 },
                recommendation: 'No recommendation',
              };
            });
            setCandidates(mapped);
            setIsLoading(false);
            return;
          }
        }
      }

      // Default: fetch first few candidates from directory
      const cRes = await getApi<PaginatedResult<Candidate>>('/candidates?page=1&pageSize=10');
      const cList = cRes?.data || [];
      if (cList.length > 0) {
        const mapped: ComparisonCandidate[] = cList.slice(0, 3).map((cand, idx) => {
          const name = `${cand.firstName} ${cand.lastName}`;
            const score = 0;
          return {
            id: cand.id,
            candidateCode: cand.candidateCode,
            name,
            role: cand.currentTitle || '',
            avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
            matchScore: score,
            matchGrade: score >= 90 ? 'High Match' : 'Good Match',
            skills: cand.skills || [],
            experience: cand.experienceYears != null ? `${cand.experienceYears} years experience` : '',
            education: '',
            ratings: { technical: 0, communication: 0, teamwork: 0 },
            recommendation: 'No recommendation',
          };
        });
        setCandidates(mapped);
      }
    } catch {
      // Keep existing candidates
    } finally {
      setIsLoading(false);
    }
  }, [queryIds, selectedVacancyId, vacancies]);

  useEffect(() => {
    void loadComparisonData();
  }, [loadComparisonData]);

  // ── 3. Fetch candidate pool for "Add Candidate" modal ──
  const openAddCandidateModal = async () => {
    setIsAddModalOpen(true);
    try {
      const res = await getApi<PaginatedResult<Candidate>>('/candidates?page=1&pageSize=30');
      const currentIds = new Set(candidates.map((c) => c.id));
      setAvailableCandidates((res?.data || []).filter((c) => !currentIds.has(c.id)));
    } catch {
      setAvailableCandidates([]);
    }
  };

  const handleAddCandidate = (cand: Candidate) => {
    const nextIdx = candidates.length;
    const name = `${cand.firstName} ${cand.lastName}`;
    const newEntry: ComparisonCandidate = {
      id: cand.id,
      candidateCode: cand.candidateCode,
      name,
      role: cand.currentTitle || '',
      avatarColor: AVATAR_COLORS[nextIdx % AVATAR_COLORS.length],
      matchScore: 0,
      matchGrade: 'No score',
      skills: cand.skills || [],
      experience: cand.experienceYears != null ? `${cand.experienceYears} years professional experience` : '',
      education: '',
      ratings: { technical: 0, communication: 0, teamwork: 0 },
      recommendation: 'No recommendation',
    };
    setCandidates((prev) => [...prev, newEntry]);
    setIsAddModalOpen(false);
    showToast(`✓ Added ${name} to comparison matrix`);
  };

  const handleRemove = (id: string) => {
    if (candidates.length <= 1) {
      showToast('At least one candidate must remain in the comparison matrix.');
      return;
    }
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const handleVacancyChange = (newVacId: string) => {
    setSelectedVacancyId(newVacId);
    const next = new URLSearchParams(searchParams);
    if (newVacId) {
      next.set('vacancyId', newVacId);
      next.delete('ids');
    } else {
      next.delete('vacancyId');
    }
    setSearchParams(next, { replace: true });
  };

  // ── Dynamic Summary Calculations ──
  const activeVacancy = useMemo(() => {
    return vacancies.find((v) => v.id === selectedVacancyId) || null;
  }, [vacancies, selectedVacancyId]);

  const topMatchCandidate = useMemo(() => {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.matchScore - a.matchScore)[0];
  }, [candidates]);

  const highestTechnicalCandidate = useMemo(() => {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.ratings.technical - a.ratings.technical)[0];
  }, [candidates]);

  const highestCommCandidate = useMemo(() => {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.ratings.communication - a.ratings.communication)[0];
  }, [candidates]);

  const filteredAvailableCandidates = useMemo(() => {
    if (!modalSearch.trim()) return availableCandidates;
    const q = modalSearch.toLowerCase();
    return availableCandidates.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.currentTitle && c.currentTitle.toLowerCase().includes(q))
    );
  }, [availableCandidates, modalSearch]);

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
            <QuickGuideTrigger />
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
            onClick={() => void openAddCandidateModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shadow-blue-500/20"
          >
            <Icon name="plus" size={14} />
            <span>Add Candidate</span>
          </button>
        </div>
      </div>

      {/* ── Position Selector Bar (Dynamic Switcher for Same Position Comparison) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Icon name="briefcase" size={18} />
          </div>
          <div>
            <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Active Position Filter</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {activeVacancy
                ? `${activeVacancy.position?.title || activeVacancy.title} (${activeVacancy.vacancyCode})`
                : 'Custom Comparison Matrix'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Compare Requisition:
          </label>
          <select
            value={selectedVacancyId}
            onChange={(e) => handleVacancyChange(e.target.value)}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs max-w-xs truncate"
          >
            <option value="">-- All Candidates / Custom Set --</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                [{v.vacancyCode}] {v.position?.title || v.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Comparison Grid & Summary ── */}
      {isLoading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <Spinner size={28} className="mx-auto text-blue-600" />
          <p className="text-xs font-bold text-slate-500">Loading candidates from database...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <Icon name="users" size={32} className="mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No candidates selected for comparison</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Pick a position from the dropdown above or click "Add Candidate" to compare profiles side-by-side.
          </p>
          <button
            type="button"
            onClick={() => void openAddCandidateModal()}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Add Candidate to Compare
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Dynamic Candidate Comparison Columns */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <ComparisonMatrixCard
                key={c.id}
                candidate={c}
                onRemove={handleRemove}
                onSelectOffer={(cand) => {
                  showToast(`✓ Selected ${cand.name} to advance to Offer Creation!`);
                  setTimeout(
                    () =>
                      navigate(
                        `/offers/create?candidateId=${cand.id}${
                          selectedVacancyId ? `&vacancyId=${selectedVacancyId}` : ''
                        }`
                      ),
                    1000
                  );
                }}
              />
            ))}
          </div>

          {/* Right: Comparison Summary (Calculated Dynamically from Active Candidates) */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              Hiring Team Recommendation
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Best Overall Match</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {topMatchCandidate?.name || '—'}
                  </span>
                  <span className="font-black text-blue-600 dark:text-blue-400">
                    {topMatchCandidate ? `${topMatchCandidate.matchScore}%` : '—'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Highest Clinical Score</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {highestTechnicalCandidate?.name || '—'}
                  </span>
                  <span className="font-black text-blue-600 dark:text-blue-400">
                    {highestTechnicalCandidate ? `${highestTechnicalCandidate.ratings.technical}.0 / 5` : '—'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Highest Communication Score</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {highestCommCandidate?.name || '—'}
                  </span>
                  <span className="font-black text-blue-600 dark:text-blue-400">
                    {highestCommCandidate ? `${highestCommCandidate.ratings.communication}.0 / 5` : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {topMatchCandidate && (
                <button
                  type="button"
                  onClick={() => {
                    showToast(`✓ Advanced ${topMatchCandidate.name} to formal employment offer generation.`);
                    setTimeout(() => navigate(`/offers/create?candidateId=${topMatchCandidate.id}${selectedVacancyId ? `&vacancyId=${selectedVacancyId}` : ''}`), 1000);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  Advance Top Candidate ({topMatchCandidate.name})
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/candidates')}
                className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Back to Candidates Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Candidate Modal ── */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Candidate to Comparison"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select a verified candidate from the directory to add to this side-by-side comparison matrix.
            </p>

            <input
              type="text"
              placeholder="Search by candidate name or title..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAvailableCandidates.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No additional candidates available.</p>
              ) : (
                filteredAvailableCandidates.map((c) => (
                  <div
                    key={c.id}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 px-2 rounded-lg cursor-pointer"
                    onClick={() => handleAddCandidate(c)}
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {c.currentTitle || 'Applicant'} &bull; {c.email}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100"
                    >
                      + Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default CandidateComparisonPage;
