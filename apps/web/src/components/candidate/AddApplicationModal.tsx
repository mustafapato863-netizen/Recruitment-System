import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Candidate, PaginatedResult, Vacancy, Application } from '@recruitflow/contracts';
import { getApi, postApi } from '../../api/client';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Alert } from '../ui/Alert';
import { Icon } from '../Icon';
import { useMasterDataOptions } from '../../hooks/useMasterDataOptions';
import { CANDIDATE_SOURCE_FALLBACK } from '../../data/masterDataDefaults';

export interface AddApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedVacancyId?: string | null;
  preselectedVacancyTitle?: string | null;
  onSuccess: (newApp: Application) => void;
}

export function AddApplicationModal({
  isOpen,
  onClose,
  preselectedVacancyId,
  preselectedVacancyTitle,
  onSuccess,
}: AddApplicationModalProps) {
  const navigate = useNavigate();
  // Mode: existing candidate vs create new candidate
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Candidate Data State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);

  // New Candidate Fields
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCurrentTitle, setNewCurrentTitle] = useState('');

  // Vacancy Data State
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState(preselectedVacancyId || '');
  const [isVacanciesLoading, setIsVacanciesLoading] = useState(false);

  // Application fields
  const [source, setSource] = useState('LinkedIn');
  const [initialNote, setInitialNote] = useState('');

  // Submission & Error State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { options: candidateSourceOptions } = useMasterDataOptions('candidate-sources', CANDIDATE_SOURCE_FALLBACK);

  useEffect(() => {
    if (candidateSourceOptions.length === 0) return;
    if (candidateSourceOptions.some((option) => option.name === source)) return;
    setSource(candidateSourceOptions[0].name);
  }, [candidateSourceOptions, source]);

  // Reset form when modal opens or vacancy changes
  useEffect(() => {
    if (isOpen) {
      setMode('existing');
      setSelectedCandidateId('');
      setCandidateSearch('');
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewCurrentTitle('');
      setSelectedVacancyId(preselectedVacancyId || '');
      setSource(candidateSourceOptions[0]?.name || CANDIDATE_SOURCE_FALLBACK[0]);
      setInitialNote('');
      setErrorMessage(null);

      // Load candidates
      setIsCandidatesLoading(true);
      getApi<PaginatedResult<Candidate> | Candidate[]>('/candidates?pageSize=100')
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setCandidates(list);
          if (list.length > 0 && !selectedCandidateId) {
            setSelectedCandidateId(list[0].id);
          }
        })
        .catch(() => {
          setCandidates([]);
        })
        .finally(() => {
          setIsCandidatesLoading(false);
        });

      // Load vacancies if not preselected
      if (!preselectedVacancyId) {
        setIsVacanciesLoading(true);
        getApi<Vacancy[] | { data: Vacancy[] }>('/vacancies')
          .then((res) => {
            const vList = Array.isArray(res) ? res : (res as unknown as { data: Vacancy[] })?.data || [];
            const availableVacancies = vList.filter((vacancy) =>
              vacancy.status !== 'Open' || vacancy.assignments?.some((assignment) =>
                assignment.isActive && (assignment.assignmentKind ?? 'PRIMARY') === 'PRIMARY',
              ),
            );
            setVacancies(availableVacancies);
            if (availableVacancies.length > 0 && !selectedVacancyId) {
              setSelectedVacancyId(availableVacancies[0].id);
            }
          })
          .catch(() => {
            setVacancies([]);
          })
          .finally(() => {
            setIsVacanciesLoading(false);
          });
      }
    }
  }, [isOpen, preselectedVacancyId]);

  // Filter candidates by name or email
  const filteredCandidates = useMemo(() => {
    if (!candidateSearch.trim()) return candidates;
    const q = candidateSearch.toLowerCase();
    return candidates.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [candidates, candidateSearch]);

  const matchingCandidate = useMemo(() => {
    if (!newEmail.trim() || mode !== 'new') return null;
    const target = newEmail.trim().toLowerCase();
    return candidates.find((c) => c.email?.toLowerCase() === target) || null;
  }, [newEmail, mode, candidates]);

  const handleUploadCv = () => {
    const targetVacancyId = preselectedVacancyId || selectedVacancyId;
    onClose();
    navigate(targetVacancyId ? `/cv-intake?vacancyId=${encodeURIComponent(targetVacancyId)}` : '/cv-intake');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetVacancyId = preselectedVacancyId || selectedVacancyId;
    if (!targetVacancyId) {
      setErrorMessage('Please select a target job position/vacancy.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalCandidateId = selectedCandidateId;

      // 1. Create candidate if in 'new' mode
      if (mode === 'new') {
        const validEmail = /^\S+@\S+\.\S+$/.test(newEmail.trim());
        const validPhone = newPhone.replace(/\D/g, '').length >= 7;
        if (!newFirstName.trim() || !newLastName.trim() || (!validEmail && !validPhone)) {
          setErrorMessage('First name, last name, and a valid email or phone number are required for a new candidate.');
          setIsSubmitting(false);
          return;
        }

        const createdCandidate = await postApi<Candidate>('/candidates', {
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          email: validEmail ? newEmail.trim().toLowerCase() : null,
          ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
          ...(newCurrentTitle.trim() ? { currentTitle: newCurrentTitle.trim() } : {}),
          source,
        });

        if (!createdCandidate?.id) {
          throw new Error('Candidate was created but ID was not returned.');
        }
        finalCandidateId = createdCandidate.id;
      } else {
        if (!finalCandidateId) {
          setErrorMessage('Please select an existing candidate.');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Create application
      const createdApp = await postApi<Application>('/applications', {
        candidateId: finalCandidateId,
        vacancyId: targetVacancyId,
        source,
      });

      // 3. Post initial note if provided
      if (initialNote.trim() && createdApp?.id) {
        try {
          await postApi(`/applications/${createdApp.id}/notes`, {
            content: initialNote.trim(),
          });
        } catch {
          // Non-blocking note post failure
        }
      }

      onSuccess(createdApp);
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to create application. Please check your inputs.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Candidate to Pipeline"
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {errorMessage && (
          <Alert tone="danger" role="alert">
            {errorMessage}
          </Alert>
        )}

        {/* ── Vacancy Context ── */}
        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Icon name="briefcase" size={15} />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300">
                Target Job Position
              </span>
              <span className="block text-xs font-bold text-slate-900 dark:text-white">
                {preselectedVacancyTitle ||
                  vacancies.find((v) => v.id === selectedVacancyId)?.position?.title ||
                  vacancies.find((v) => v.id === selectedVacancyId)?.title ||
                  'Select Position Below'}
              </span>
            </div>
          </div>
          {preselectedVacancyId ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 shrink-0">
              Position Locked
            </span>
          ) : (
            <div className="w-48">
              <Select
                value={selectedVacancyId}
                onChange={(e) => setSelectedVacancyId(e.target.value)}
                disabled={isVacanciesLoading}
                className="text-xs"
              >
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.position?.title || v.title || v.id}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* ── Candidate Mode Selector ── */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
            Add candidate
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'existing'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon name="users" size={14} />
              <span>Existing Candidate</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'new'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon name="user" size={14} />
              <span>Full details</span>
            </button>
            <button
              type="button"
              onClick={handleUploadCv}
              className="py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Icon name="upload" size={14} />
              <span>Upload CV</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Upload CV opens the full extraction and matching flow, while Full details keeps manual entry in this form.
          </p>
        </div>

        {/* ── Tab: Existing Candidate ── */}
        {mode === 'existing' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Search & Choose Candidate
              </label>
              <Input
                placeholder="Filter by name, email, or phone..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="text-xs mb-2"
              />
            </div>

            {isCandidatesLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading candidates directory...</div>
            ) : filteredCandidates.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                No matching candidates found.{' '}
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Create new candidate instead?
                </button>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 rf-scrollbar border border-slate-200/80 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/20">
                {filteredCandidates.map((c) => {
                  const isSelected = selectedCandidateId === c.id;
                  const fullName = `${c.firstName} ${c.lastName}`.trim();
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCandidateId(c.id)}
                      className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.firstName?.[0] || 'C'}
                          {c.lastName?.[0] || ''}
                        </div>
                        <div className="truncate">
                          <span className="block text-xs font-bold truncate">{fullName}</span>
                          <span className="block text-[11px] text-slate-400 truncate">{c.email || c.phone || 'No contact provided'}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center">
                        <input
                          type="radio"
                          name="selectedCandidate"
                          checked={isSelected}
                          onChange={() => setSelectedCandidateId(c.id)}
                          className="text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Create New Candidate ── */}
        {mode === 'new' && (
          <div className="space-y-3.5 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  First Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Tariq"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Last Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Mansoor"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. tariq.mansoor@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="text-xs"
                />
                {matchingCandidate && (
                  <div className="mt-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 animate-fade-in">
                    <span>
                      Existing profile found: <strong>{matchingCandidate.firstName} {matchingCandidate.lastName}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCandidateId(matchingCandidate.id);
                        setMode('existing');
                      }}
                      className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-white font-bold hover:bg-amber-300 transition cursor-pointer shrink-0"
                    >
                      Use Profile
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Phone (Optional)
                </label>
                <Input
                  type="tel"
                  placeholder="+966 50 123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Current Title / Headline (Optional)
              </label>
              <Input
                placeholder="e.g. Senior Registered Nurse"
                value={newCurrentTitle}
                onChange={(e) => setNewCurrentTitle(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* ── Sourcing Channel ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Sourcing Channel
            </label>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="text-xs"
            >
              {candidateSourceOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Initial Stage
            </label>
            <div className="py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Applied (Default)</span>
            </div>
          </div>
        </div>

        {/* ── Initial Internal Note ── */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            Recruiter Note / Referral Justification (Optional)
          </label>
          <textarea
            rows={2}
            value={initialNote}
            onChange={(e) => setInitialNote(e.target.value)}
            placeholder="e.g. Recommended by Dr. Ahmed from Surgery Department. 5+ years experience in JCI accredited hospital."
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ── Footer Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Add to Pipeline
          </Button>
        </div>
      </form>
    </Modal>
  );
}
