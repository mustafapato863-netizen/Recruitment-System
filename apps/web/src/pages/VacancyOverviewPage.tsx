import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { VacancyDetailView, Application, PaginatedResult, Interview, Offer, VacancyStatus } from '@recruitflow/contracts';
import { fetchApi, getApi, patchApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { AddApplicationModal } from '../components/candidate/AddApplicationModal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { PageState } from '../components/ui/PageState';
import { useSetBreadcrumbTitle } from '../context/BreadcrumbContext';
import { QuickGuideTrigger } from '../quickguide';

interface InterviewerUser {
  id: string;
  displayName: string;
  name?: string;
  email?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return 'UN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function VacancyOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<VacancyDetailView | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [interviewers, setInterviewers] = useState<InterviewerUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'pipeline' | 'interviews' | 'posting' | 'activity' | 'settings'>('overview');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddApplicantModalOpen, setIsAddApplicantModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [editFormData, setEditFormData] = useState<{
    title: string;
    approvedHeadcount: number;
    status: VacancyStatus;
    location: string;
    department: string;
    jobSummary: string;
    description: string;
    responsibilities: string;
    qualifications: string;
    benefits: string;
  }>({
    title: '',
    approvedHeadcount: 1,
    status: 'Open',
    location: '',
    department: '',
    jobSummary: '',
    description: '',
    responsibilities: '',
    qualifications: '',
    benefits: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCloneRequisition = async () => {
    if (!vacancy) return;
    setIsCloning(true);
    try {
      const cloned = await postApi<VacancyDetailView>('/vacancies', {
        title: `Copy of ${vacancy.position?.title || vacancy.title || 'Requisition'}`,
        positionId: vacancy.positionId,
        branchId: vacancy.branchId,
        approvedHeadcount: vacancy.approvedHeadcount ?? 1,
        location: vacancy.location,
        workType: (vacancy as unknown as { workType?: string })?.workType || 'Full-time',
      });
      showToast('✓ Requisition cloned successfully!');
      setIsActionsDropdownOpen(false);
      if (cloned?.id) {
        navigate(`/vacancies/${cloned.id}`);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to clone requisition');
    } finally {
      setIsCloning(false);
    }
  };

  const handleStatusChange = async (newStatus: VacancyStatus) => {
    if (!id) return;
    try {
      const updated = await patchApi<VacancyDetailView>(`/vacancies/${id}/status`, { status: newStatus });
      if (updated) {
        setVacancy(updated);
      }
      showToast(`✓ Requisition status updated to ${newStatus}`);
      setIsActionsDropdownOpen(false);
      void loadAllData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const openEditModal = () => {
    if (vacancy) {
      setEditFormData({
        title: vacancy.position?.title || vacancy.title || '',
        approvedHeadcount: vacancy.approvedHeadcount ?? 1,
        status: (vacancy.status as VacancyStatus) || 'Open',
        location: vacancy.location || '',
        department: vacancy.department || '',
        jobSummary: vacancy.jobSummary || '',
        description: vacancy.description || '',
        responsibilities: vacancy.responsibilities || '',
        qualifications: vacancy.qualifications || '',
        benefits: vacancy.benefits || '',
      });
    }
    setIsEditModalOpen(true);
  };

  const handleSaveVacancyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSavingEdit(true);
    try {
      const updated = await patchApi<VacancyDetailView>(`/vacancies/${id}`, {
        title: editFormData.title.trim(),
        approvedHeadcount: Number(editFormData.approvedHeadcount) || 1,
        status: editFormData.status,
        location: editFormData.location.trim() || undefined,
        department: editFormData.department.trim() || undefined,
        jobSummary: editFormData.jobSummary.trim() || undefined,
        description: editFormData.description.trim() || undefined,
        responsibilities: editFormData.responsibilities.trim() || undefined,
        qualifications: editFormData.qualifications.trim() || undefined,
        benefits: editFormData.benefits.trim() || undefined,
      });
      if (updated) {
        setVacancy(updated);
      }
      showToast('Position updated successfully');
      setIsEditModalOpen(false);
      void loadAllData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadAllData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [vRes, appsRes, intsRes, offsRes, usersRes] = await Promise.allSettled([
        fetchApi<VacancyDetailView>(`/vacancies/${id}`),
        getApi<PaginatedResult<Application>>(`/applications?vacancyId=${id}&pageSize=100`),
        getApi<Interview[]>('/interviews'),
        getApi<Offer[]>('/offers'),
        getApi<InterviewerUser[]>('/users/interviewers'),
      ]);
      if (vRes.status === 'fulfilled' && vRes.value) {
        setVacancy(vRes.value);
      }
      if (appsRes.status === 'fulfilled' && appsRes.value?.data) {
        setApplications(appsRes.value.data);
      }
      if (intsRes.status === 'fulfilled' && intsRes.value) {
        setInterviews(intsRes.value);
      }
      if (offsRes.status === 'fulfilled' && offsRes.value) {
        setOffers(offsRes.value);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value) {
        setInterviewers(usersRes.value);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const jobTitle = vacancy?.position?.title || vacancy?.title || 'No position';
  useSetBreadcrumbTitle(jobTitle && jobTitle !== 'No position' ? jobTitle : 'Job Requisition');
  const departmentName = vacancy?.department || vacancy?.branch?.name || '—';
  const locationText = vacancy?.location || vacancy?.branch?.name || '—';
  const statusLabel = vacancy?.status || '—';
  const hasPrimaryAssignment = Boolean(vacancy?.assignments?.some((assignment) =>
    assignment.isActive && (assignment.assignmentKind ?? 'PRIMARY') === 'PRIMARY',
  ));
  const isOpenWithoutAssignment = vacancy?.status === 'Open' && !hasPrimaryAssignment;

  const vacancyApps = applications;
  const appIds = new Set(applications.map((a) => a.id));
  const vacancyInterviews = interviews.filter((i) => appIds.has(i.applicationId));
  const vacancyOffers = offers.filter((o) => appIds.has(o.applicationId));

  const applicationsCount = vacancy?.funnelCounts?.applied ?? vacancyApps.length;
  const interviewsCount = vacancy?.funnelCounts?.interviews ?? vacancyInterviews.length;
  const offersCount = vacancy?.funnelCounts?.offer ?? vacancyOffers.length;
  const hiresCount = vacancy?.joinedHeadcount ?? vacancy?.funnelCounts?.joined ?? vacancyApps.filter((a) => a.stage === 'Joined' || (a as unknown as { stage?: string; status?: string }).stage === 'Hired' || (a as unknown as { status?: string }).status === 'HIRED').length;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const appsThisWeek = vacancyApps.filter((a) => new Date(a.appliedAt || a.createdAt) >= oneWeekAgo).length;
  const intsThisWeek = vacancyInterviews.filter((i) => new Date(i.scheduledStart || (i as unknown as { scheduledAt?: string }).scheduledAt || '1970-01-01') >= oneWeekAgo).length;
  const offersThisWeek = vacancyOffers.filter((o) => new Date(o.createdAt) >= oneWeekAgo).length;

  const daysOpen = vacancy?.openedAt || vacancy?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(vacancy.openedAt || vacancy.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const targetDays = 45;
  const slaPercent = Math.min(100, Math.round((daysOpen / targetDays) * 100));

  const teamMembers = (vacancy?.assignments || []).map((assignment) => {
    const user = interviewers.find((u) => u.id === assignment.userId) || (assignment as unknown as { user?: { displayName?: string; name?: string } }).user;
    const name = user?.displayName || user?.name || 'Unassigned';
    const role = assignment.roleCode
      ? assignment.roleCode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Recruiter';
    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n: string) => n[0].toUpperCase())
        .join('') || 'U';
    return {
      id: assignment.id || assignment.userId,
      name,
      role,
      initials,
    };
  });

  const activities = [
    ...vacancyApps.map((a) => {
      const candidateName = a.candidate
        ? `${a.candidate.firstName} ${a.candidate.lastName}`.trim()
        : (a as unknown as { candidateName?: string }).candidateName || 'Unknown candidate';
      return {
        id: `app-${a.id}`,
        icon: 'users' as const,
        color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600',
        title: 'Application received',
        desc: `${candidateName} (APP-${a.id.slice(0, 8)}) applied`,
        date: new Date(a.appliedAt || a.createdAt),
      };
    }),
    ...vacancyInterviews.map((i) => {
      const app = vacancyApps.find((a) => a.id === i.applicationId);
      const candidateName = app?.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
        : (app as unknown as { candidateName?: string })?.candidateName || 'Candidate';
      return {
        id: `int-${i.id}`,
        icon: 'calendar' as const,
        color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600',
        title: 'Interview scheduled',
        desc: `With ${candidateName} (${i.status || 'Scheduled'})`,
          date: new Date(i.scheduledStart || (i as unknown as { scheduledAt?: string; createdAt?: string }).scheduledAt || (i as unknown as { createdAt?: string }).createdAt || '1970-01-01'),
      };
    }),
    ...(vacancy?.createdAt
      ? [
          {
            id: `vac-${vacancy.id}`,
            icon: 'file-text' as const,
            color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600',
            title: 'Requisition opened',
            desc: `${jobTitle} (${vacancy.vacancyCode || 'REQ'})`,
            date: new Date(vacancy.createdAt),
          },
        ]
      : []),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 4);

  if (isLoading && !vacancy) {
    return (
      <div className="flex w-full flex-col p-6 max-w-[1720px] mx-auto">
        <PageState kind="loading" title="Loading job position..." description="Fetching vacancy details and pipeline metrics." />
      </div>
    );
  }

  if (!isLoading && !vacancy && id) {
    return (
      <div className="flex w-full flex-col p-6 max-w-[1720px] mx-auto">
        <PageState
          kind="empty"
          title="Job position not found"
          description="The requested job position could not be found or has been removed."
          actionLabel="Back to Job Positions"
          onAction={() => navigate('/vacancies')}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Top Back Navigation ── */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/vacancies')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition cursor-pointer"
        >
          &larr; Back to Job Positions
        </button>
      </div>

      {/* ── Page Header: Job Title & Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {jobTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {statusLabel}
            </span>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            {departmentName} &bull; {locationText} &bull; {vacancy?.vacancyRequest?.employmentType || 'Full-time'} &bull; Created {vacancy?.createdAt ? new Date(vacancy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </p>
          {isOpenWithoutAssignment && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <Icon name="alert-triangle" size={12} />
              Assign a primary recruiter before working on this open vacancy.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={`/careers/${encodeURIComponent(vacancy?.organizationCode || '')}/jobs/${encodeURIComponent(vacancy?.vacancyCode || id || '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition shadow-xs cursor-pointer"
            title="Preview live public career application page"
          >
            <Icon name="external-link" size={13} />
            <span>Public Preview</span>
          </a>

          <button
            type="button"
            onClick={() => setIsAddApplicantModalOpen(true)}
            disabled={isOpenWithoutAssignment}
            title={isOpenWithoutAssignment ? 'Assign a primary recruiter before adding candidates' : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="plus" size={14} />
            <span>Add Candidate</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <span>Share</span>
            <Icon name="share" size={13} className="text-slate-400" />
          </button>

          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <span>Edit</span>
            <Icon name="edit" size={13} className="text-slate-400" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsActionsDropdownOpen((prev) => !prev)}
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
              title="Position actions"
            >
              <Icon name="more-vertical" size={15} />
            </button>

            {isActionsDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-30 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => navigate(`/applications?vacancyId=${id}`)}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Icon name="folder-kanban" size={13} className="text-blue-500" />
                  <span>Open Kanban Pipeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/vacancies/${id}/analytics`)}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Icon name="report" size={13} className="text-purple-500" />
                  <span>View Job Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCloneRequisition()}
                  disabled={isCloning}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  <Icon name="copy" size={13} className="text-emerald-500" />
                  <span>{isCloning ? 'Cloning...' : 'Clone Requisition'}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Change Status
                </div>
                {(['Open', 'On Hold', 'Cancelled'] as VacancyStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void handleStatusChange(st)}
                    disabled={vacancy?.status === st}
                    className={`w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-semibold cursor-pointer ${
                      vacancy?.status === st
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{st}</span>
                    {vacancy?.status === st && <Icon name="check" size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Persistent RecruitFlow Smart Stat Buttons (E9.2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Applications */}
        <div
          onClick={() => navigate(`/applications?vacancyId=${id || ''}`)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition cursor-pointer flex items-center justify-between group"
          title="View candidate pipeline for this position"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Icon name="users" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Applications</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{applicationsCount}</span>
              <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {appsThisWeek > 0 ? `+${appsThisWeek} this week` : '0 this week'}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 2: Interviews */}
        <div
          onClick={() => navigate(`/interviews?vacancyId=${id || ''}`)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition cursor-pointer flex items-center justify-between group"
          title="View scheduled interviews for this position"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="calendar" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Interviews</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{interviewsCount}</span>
              <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {intsThisWeek > 0 ? `${intsThisWeek} this week` : '0 this week'}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 3: Offers */}
        <div
          onClick={() => navigate(`/offers?vacancyId=${id || ''}`)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-800 transition cursor-pointer flex items-center justify-between group"
          title="View offers for this position"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Icon name="offer" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Offers</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{offersCount}</span>
              <span className="block text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {offersThisWeek > 0 ? `${offersThisWeek} this week` : '0 this week'}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 4: Headcount Fulfillment & Hires */}
        <div
          onClick={() => navigate(`/applications?vacancyId=${id || ''}&stage=Joined`)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800 transition cursor-pointer flex items-center justify-between group"
          title="View joined candidates & headcount fulfillment"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Icon name="user-check" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Headcount Joined</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {hiresCount} / {vacancy?.approvedHeadcount ?? 1}
              </span>
              <span className="block text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                {hiresCount >= (vacancy?.approvedHeadcount ?? 1)
                  ? 'Fulfilled (100%)'
                  : `${Math.round((hiresCount / (vacancy?.approvedHeadcount ?? 1)) * 100)}% filled`}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* ── Horizontal Navigation Tabs (Overview, Applications, Pipeline, Interviews, etc.) ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 overflow-x-auto rf-scrollbar text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('applications')}
          className={`pb-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'applications'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Applications</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {applicationsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'pipeline'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Pipeline
        </button>

        <button
          type="button"
          onClick={() => navigate(`/interviews?vacancyId=${id || ''}`)}
          className="pb-3.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Interviews</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {interviewsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate(`/offers?vacancyId=${id || ''}`)}
          className="pb-3.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Offers</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {offersCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('posting')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'posting'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Job Posting
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Activity
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Settings
        </button>

        <button
          type="button"
          onClick={() => navigate(`/vacancies/${id || ''}/analytics`)}
          className="pb-3.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Analytics</span>
          <Icon name="arrow-right" size={11} className="text-slate-400" />
        </button>
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
        <>
          {/* ── 3-Column Middle Grid (SLA Progress, Owner & Hiring Team, Last Activity) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: SLA Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              SLA Progress
            </h2>
            <button
              type="button"
              onClick={() => showToast(`SLA metrics: Days open: ${daysOpen}d / ${targetDays}d target (${slaPercent}%)`)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View details
            </button>
          </div>

          <div className="space-y-4">
            {/* Time to fill */}
            <div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">{daysOpen} days</span>
                  <span className="block text-[11px] text-slate-500">Target: {targetDays} days</span>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{slaPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${slaPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${slaPercent}%` }}
                />
              </div>
            </div>

            {/* Time in current stage */}
            <div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">Active in Pipeline</span>
                  <span className="block text-[11px] text-slate-500">{vacancyApps.length} candidates total</span>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {interviewsCount} in interview
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${vacancyApps.length > 0 ? Math.min(100, Math.round((interviewsCount / vacancyApps.length) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Owner & Hiring Team */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Hiring Team
            </h2>
            <button
              type="button"
              onClick={() =>
                showToast(
                  teamMembers.length > 0
                    ? `Team: ${teamMembers.map((t) => `${t.name} (${t.role})`).join(', ')}`
                    : 'No team members assigned'
                )
              }
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>

          {teamMembers.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">No hiring team members assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center">
                    {member.initials}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{member.name}</span>
                    <span className="block text-[11px] text-slate-500">{member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Last Activity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Last Activity
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No recent activity recorded for this position.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-full ${act.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon name={act.icon} size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">{act.title}</span>
                      <span className="block text-[10px] text-slate-500 truncate">{act.desc}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {act.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View all activity
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 3: 2-Column Bottom Grid (Role Summary [2 cols internal] & Job Details) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Role Summary */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Role Summary
            </h2>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Sub-Column: Description, Dept/Team */}
            <div className="md:col-span-7 space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {vacancy?.jobSummary ||
                  vacancy?.vacancyRequest?.jobSummary ||
                  vacancy?.vacancyRequest?.justification ||
                  vacancy?.vacancyRequest?.reason ||
                  'Requisition justification and job summary are defined per department approval.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon name="briefcase" size={16} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Department</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{departmentName}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                    <Icon name="users" size={16} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Requisition Code</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{vacancy?.vacancyCode || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">Requisition Justification</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {vacancy?.vacancyRequest?.justification ||
                    'Requisition justification details are managed in the vacancy request module.'}
                </p>
              </div>

              <div className="pt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Role Requirements</h3>
                  {!vacancy?.description && !vacancy?.responsibilities && !vacancy?.qualifications && !vacancy?.benefits && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Add requirements
                    </button>
                  )}
                </div>
                {vacancy?.description && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">About the role</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {vacancy.description}
                    </p>
                  </div>
                )}
                {vacancy?.responsibilities && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Key responsibilities</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {vacancy.responsibilities}
                    </p>
                  </div>
                )}
                {vacancy?.qualifications && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Required qualifications</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {vacancy.qualifications}
                    </p>
                  </div>
                )}
                {vacancy?.benefits && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Benefits & highlights</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {vacancy.benefits}
                    </p>
                  </div>
                )}
                {!vacancy?.description && !vacancy?.responsibilities && !vacancy?.qualifications && !vacancy?.benefits && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                    No role requirements yet. They are drafted on the vacancy request and can be edited here at any time.
                  </p>
                )}
              </div>
            </div>

            {/* Right Sub-Column: Requisition Requirements & Details */}
            <div className="md:col-span-5 space-y-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2.5">Requisition Parameters</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    `Position: ${jobTitle}`,
                    `Branch: ${vacancy?.branch?.name || 'Main Branch'}`,
                    `Type: ${vacancy?.vacancyRequest?.employmentType || 'Full-time'}`,
                    `Budget: ${vacancy?.vacancyRequest?.budgetStatus || 'Approved'}`,
                    `Priority: ${vacancy?.vacancyRequest?.criticality || 'Standard'}`,
                    `Headcount: ${vacancy?.approvedHeadcount || 1}`,
                    ...(vacancy?.position?.code ? [`Code: ${vacancy.position.code}`] : []),
                  ].map((attr) => (
                    <span
                      key={attr}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold border border-slate-200 dark:border-slate-700"
                    >
                      {attr}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon name="briefcase" size={15} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Requisition Priority</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      {vacancy?.vacancyRequest?.criticality || 'Standard'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                    <Icon name="award" size={15} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Target Headcount</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      {vacancy?.approvedHeadcount || 1} approved ({hiresCount} joined)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Job Details (4 cols out of 12) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Job Details
            </h2>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="calendar" size={14} className="text-slate-400" />
                Employment Type
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {vacancy?.vacancyRequest?.employmentType || 'Full-time'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="map-pin" size={14} className="text-slate-400" />
                Work Location
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{locationText}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="award" size={14} className="text-slate-400" />
                Budget Status
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {vacancy?.vacancyRequest?.budgetStatus || 'Approved'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="briefcase" size={14} className="text-slate-400" />
                Requisition Code
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{vacancy?.vacancyCode || '—'}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="offer" size={14} className="text-slate-400" />
                Headcount
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {vacancy?.approvedHeadcount || 1} approved / {hiresCount} joined
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="calendar" size={14} className="text-slate-400" />
                Posted On
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {vacancy?.createdAt ? new Date(vacancy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="clock" size={14} className="text-slate-400" />
                Target Start Date
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {vacancy?.targetStartDate || vacancy?.vacancyRequest?.targetStartDate
                  ? new Date(vacancy?.targetStartDate || vacancy?.vacancyRequest?.targetStartDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* ── Tab: Pipeline (E6.1 In-Context Vacancy Kanban) ── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Icon name="pipeline" size={12} />
                  Position Pipeline
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {vacancyApps.length} Applicants in Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track candidate progression across recruitment stages for {jobTitle}.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <span className="block text-[11px] text-slate-400 font-semibold uppercase">Headcount Closed</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  {hiresCount} / {vacancy?.approvedHeadcount || 1} Filled
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddApplicantModalOpen(true)}
                  disabled={isOpenWithoutAssignment}
                  title={isOpenWithoutAssignment ? 'Assign a primary recruiter before adding candidates' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="plus" size={13} />
                  <span>Add Candidate</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/applications?vacancyId=${id || ''}`)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-xs cursor-pointer"
                >
                  <span>Full-Screen Kanban</span>
                  <Icon name="arrow-right" size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-4 pt-1">
            <div className="flex gap-4 items-start min-w-[1300px]">
              {[
                { id: 'Applied', name: 'New Applied', tone: 'bg-slate-500' },
                { id: 'Screening', name: 'Screening', tone: 'bg-emerald-500' },
                { id: 'Interview', name: 'Interview', tone: 'bg-blue-500' },
                { id: 'Offer', name: 'Offer', tone: 'bg-amber-500' },
                { id: 'Pre-Hire', name: 'Pre-Hire', tone: 'bg-purple-500' },
                { id: 'Joined', name: 'Hired', tone: 'bg-teal-500' },
              ].map((col) => {
                const stageApps = vacancyApps.filter((a) => {
                  if (col.id === 'Joined') return a.stage === 'Joined';
                  if (col.id === 'Applied') return a.stage === 'Applied' || !a.stage;
                  return a.stage === col.id;
                });

                return (
                  <div
                    key={col.id}
                    className="w-[210px] min-w-[210px] shrink-0 bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 flex flex-col space-y-3"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${col.tone}`} />
                        <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">{col.name}</h3>
                      </div>
                      <span className="w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-black flex items-center justify-center">
                        {stageApps.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 min-h-[220px]">
                      {stageApps.map((app) => {
                        const candName = app.candidate
                          ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
                          : (app as unknown as { candidateName?: string })?.candidateName || 'Candidate';
                        const candInitials = getInitials(candName);

                        return (
                          <div
                            key={app.id}
                            onClick={() => navigate(`/applications/${app.id}`)}
                            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group space-y-2"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                  {candInitials}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition block truncate">
                                    {candName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {app.applicationCode || `APP-${app.id.slice(0, 8)}`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10.5px] text-slate-400">
                              <span>{app.source || 'Portal'}</span>
                              <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:underline">
                                View &rarr;
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {stageApps.length === 0 && (
                        <div className="h-24 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-[11px] text-slate-400">
                          No candidates
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Applications List ── */}
      {activeTab === 'applications' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Applicants for {jobTitle} ({vacancyApps.length})
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddApplicantModalOpen(true)}
                disabled={isOpenWithoutAssignment}
                title={isOpenWithoutAssignment ? 'Assign a primary recruiter before adding candidates' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="plus" size={12} />
                <span>Add Candidate</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/applications?vacancyId=${id || ''}`)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Open in Applications workspace &rarr;
              </button>
            </div>
          </div>
          {vacancyApps.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No applications recorded for this requisition yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {vacancyApps.map((app) => {
                const candName = app.candidate
                  ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
                  : (app as unknown as { candidateName?: string })?.candidateName || 'Candidate';
                return (
                  <div
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(candName)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {candName}
                        </span>
                        <span className="text-[11px] text-slate-400 block font-mono">
                          {app.applicationCode || `APP-${app.id.slice(0, 8)}`} &bull; Applied{' '}
                          {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-GB') : 'Recently'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {app.stage || 'Applied'}
                      </span>
                      <Icon name="chevron-right" size={16} className="text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Job Posting ── */}
      {activeTab === 'posting' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{jobTitle}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {departmentName} &bull; {locationText} &bull; Requisition Code: {vacancy?.vacancyCode || '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              <Icon name="share" size={13} />
              <span>Share Job Link</span>
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Position Overview</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {vacancy?.vacancyRequest?.justification ||
                vacancy?.vacancyRequest?.reason ||
                'No detailed job description has been published for this requisition yet.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Employment Type</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white mt-1">
                  {vacancy?.vacancyRequest?.employmentType || 'Full-time'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Approved Headcount</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white mt-1">
                  {vacancy?.approvedHeadcount || 1} Position{vacancy?.approvedHeadcount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Budget Status</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white mt-1">
                  {vacancy?.vacancyRequest?.budgetStatus || 'Approved'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Activity Feed ── */}
      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Position Activity Log ({activities.length})
            </h2>
          </div>
          {activities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No activity recorded for this position yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl">
                  <div className={`w-8 h-8 rounded-full ${act.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon name={act.icon} size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{act.title}</span>
                    <span className="block text-xs text-slate-500">{act.desc}</span>
                    <span className="block text-[10px] text-slate-400 mt-1">
                      {act.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Settings ── */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Requisition Settings</h2>
            <p className="text-xs text-slate-500">Manage vacancy configuration, budget, and assigned hiring team.</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Hiring Team</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center shrink-0">
                    {member.initials}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{member.name}</span>
                    <span className="block text-[11px] text-slate-500">{member.role}</span>
                  </div>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-xs text-slate-400 italic">No team members assigned.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Job Position"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Share this live career portal link with candidates or publish directly to external job boards.
          </p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/careers/${encodeURIComponent(vacancy?.organizationCode || '')}/jobs/${encodeURIComponent(vacancy?.vacancyCode || id || '')}`}
              className="text-xs font-mono select-all"
            />
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/careers/${encodeURIComponent(vacancy?.organizationCode || '')}/jobs/${encodeURIComponent(vacancy?.vacancyCode || id || '')}`;
                void navigator.clipboard?.writeText(url);
                showToast('Link copied to clipboard!');
                setIsShareModalOpen(false);
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
            >
              Copy
            </button>
          </div>
          <div className="pt-2 flex justify-end">
            <a
              href={`/careers/${encodeURIComponent(vacancy?.organizationCode || '')}/jobs/${encodeURIComponent(vacancy?.vacancyCode || id || '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Open career page in new tab</span>
              <Icon name="external-link" size={13} />
            </a>
          </div>
        </div>
      </Modal>

      {/* ── Real Vacancy Edit Modal (E9.6) ── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Job Position Details"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveVacancyEdit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Job Title *</label>
              <Input
                required
                value={editFormData.title}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Senior ICU Specialist"
              />
            </div>
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Target Headcount *</label>
              <Input
                type="number"
                min={1}
                max={999}
                required
                value={editFormData.approvedHeadcount}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, approvedHeadcount: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Requisition Status</label>
              <Select
                value={editFormData.status}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value as VacancyStatus }))}
              >
                <option value="Open">Open</option>
                <option value="On Hold">On Hold</option>
                <option value="Filled">Filled</option>
                <option value="Partially Filled">Partially Filled</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Pending Activation">Pending Activation</option>
              </Select>
            </div>
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Location / Facility</label>
              <Input
                value={editFormData.location}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. Riyadh Central Hospital"
              />
            </div>
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Department</label>
              <Input
                value={editFormData.department}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="e.g. Clinical Operations"
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Short Summary / Teaser</label>
            <Input
              value={editFormData.jobSummary}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, jobSummary: e.target.value }))}
              placeholder="Brief summary displayed on job listings"
            />
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">About the Role</label>
            <Textarea
              rows={4}
              value={editFormData.description}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Unit, team, shift pattern, and what success looks like..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Key Responsibilities</label>
              <Textarea
                rows={4}
                value={editFormData.responsibilities}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, responsibilities: e.target.value }))}
                placeholder="One per line..."
              />
            </div>
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Required Qualifications</label>
              <Textarea
                rows={4}
                value={editFormData.qualifications}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, qualifications: e.target.value }))}
                placeholder="Licenses, certifications, experience..."
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Benefits & Highlights</label>
            <Textarea
              rows={3}
              value={editFormData.benefits}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, benefits: e.target.value }))}
              placeholder="Package, housing, flights, CME allowance..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingEdit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSavingEdit && <Icon name="refresh-cw" size={13} className="animate-spin" />}
              <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Candidate Modal */}
      <AddApplicationModal
        isOpen={isAddApplicantModalOpen}
        onClose={() => setIsAddApplicantModalOpen(false)}
        preselectedVacancyId={id}
        preselectedVacancyTitle={jobTitle}
        onSuccess={() => {
          showToast('Candidate added to requisition pipeline successfully');
          void loadAllData();
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default VacancyOverviewPage;
