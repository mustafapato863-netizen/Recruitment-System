import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  PageFrame,
  PageState,
  Alert,
  Button,
  Badge,
  ResponsiveDataView,
  DetailSummary,
  TableSkeleton,
  ListSkeleton,
  DetailSkeleton,
  Tabs,
  TabPanel,
  Modal,
  FormField,
  Select,
  Input,
  StatusBadge,
  type TabItem,
  type ResponsiveDataColumn,
  type DetailSummaryItem,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { CandidateWorkspace } from '../components/candidate/CandidateWorkspace';
import {
  ScorecardSummary,
  aggregateInterviewScorecards,
  computeInterviewsStats,
} from '../components/candidate/ScorecardSummary';
import { getApi, postApi, patchApi } from '../api/client';
import type {
  Candidate,
  Application,
  Interview,
  Offer,
  Vacancy,
  PaginatedResult,
} from '@recruitflow/contracts';
import './PageEnhancementsV2.css';

type TabKey = 'overview' | 'applications' | 'interviews' | 'offers' | 'timeline';

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Core candidate identity state
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // Sub-resource states per tab
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState<string | null>(null);

  const interviewStats = useMemo(() => computeInterviewsStats(interviews), [interviews]);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Vacancy options for assignment modal
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Add Tag modal
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  // ─── Data Loading ────────────────────────────────────────────

  const loadAllData = async () => {
    if (!id) return;
    setCandidateLoading(true);
    setApplicationsLoading(true);
    setInterviewsLoading(true);
    setOffersLoading(true);
    setCandidateError(null);
    setApplicationsError(null);
    setInterviewsError(null);
    setOffersError(null);

    let candidateObj: Candidate | null = null;
    try {
      candidateObj = await getApi<Candidate>(`/candidates/${id}`);
      setCandidate(candidateObj);
    } catch (err: unknown) {
      setCandidateError((err as Error).message || 'Failed to load candidate details.');
      setCandidateLoading(false);
      setApplicationsLoading(false);
      setInterviewsLoading(false);
      setOffersLoading(false);
      return;
    } finally {
      setCandidateLoading(false);
    }

    // Concurrently fetch applications, interviews, offers, and vacancy options.
    // Note: Backend /applications accepts ?candidateId=:id and returns PaginatedResult<Application>.
    // Backend /interviews and /offers do not accept candidateId query parameter; we fetch and filter
    // client-side by matching against the candidate's application IDs.
    const [appsRes, interviewsRes, offersRes, vacsRes] = await Promise.allSettled([
      getApi<PaginatedResult<Application>>(`/applications?candidateId=${id}`),
      getApi<Interview[]>('/interviews'),
      getApi<Offer[]>('/offers'),
      getApi<Vacancy[]>('/vacancies'),
    ]);

    let appsData: Application[] = [];
    if (appsRes.status === 'fulfilled') {
      appsData = appsRes.value.data ?? [];
      setApplications(appsData);
      setApplicationsLoading(false);
    } else {
      setApplications([]);
      setApplicationsError((appsRes.reason as Error)?.message || 'Failed to load applications.');
      setApplicationsLoading(false);
    }

    const appIds = new Set(appsData.map((a) => a.id));

    if (interviewsRes.status === 'fulfilled') {
      const allInts = Array.isArray(interviewsRes.value) ? interviewsRes.value : [];
      const matched = allInts.filter((item) => appIds.has(item.applicationId));
      setInterviews(matched);
      setInterviewsLoading(false);
    } else {
      setInterviews([]);
      setInterviewsError((interviewsRes.reason as Error)?.message || 'Failed to load interviews.');
      setInterviewsLoading(false);
    }

    if (offersRes.status === 'fulfilled') {
      const allOffers = Array.isArray(offersRes.value) ? offersRes.value : [];
      const matched = allOffers.filter((item) => appIds.has(item.applicationId));
      setOffers(matched);
      setOffersLoading(false);
    } else {
      setOffers([]);
      setOffersError((offersRes.reason as Error)?.message || 'Failed to load offers.');
      setOffersLoading(false);
    }

    if (vacsRes.status === 'fulfilled') {
      const vacList = Array.isArray(vacsRes.value) ? vacsRes.value : [];
      setVacancies(vacList);
      if (vacList.length > 0) {
        setSelectedVacancyId((current) => current || vacList[0].id);
      }
    }
  };

  useEffect(() => {
    void loadAllData();
  }, [id]);

  // ─── Individual Tab Retry Handlers ────────────────────────────

  const retryApplications = async () => {
    if (!id) return;
    setApplicationsLoading(true);
    setApplicationsError(null);
    try {
      const res = await getApi<PaginatedResult<Application>>(`/applications?candidateId=${id}`);
      const apps = res.data ?? [];
      setApplications(apps);
      // Re-filter interviews and offers with updated application IDs
      const appIds = new Set(apps.map((a) => a.id));
      void retryInterviewsWithAppIds(appIds);
      void retryOffersWithAppIds(appIds);
    } catch (err: unknown) {
      setApplicationsError((err as Error).message || 'Failed to load applications.');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const retryInterviewsWithAppIds = async (appIds: Set<string>) => {
    setInterviewsLoading(true);
    setInterviewsError(null);
    try {
      const allInts = await getApi<Interview[]>('/interviews');
      const matched = Array.isArray(allInts) ? allInts.filter((i) => appIds.has(i.applicationId)) : [];
      setInterviews(matched);
    } catch (err: unknown) {
      setInterviewsError((err as Error).message || 'Failed to load interviews.');
    } finally {
      setInterviewsLoading(false);
    }
  };

  const retryInterviews = async () => {
    const appIds = new Set(applications.map((a) => a.id));
    await retryInterviewsWithAppIds(appIds);
  };

  const retryOffersWithAppIds = async (appIds: Set<string>) => {
    setOffersLoading(true);
    setOffersError(null);
    try {
      const allOffers = await getApi<Offer[]>('/offers');
      const matched = Array.isArray(allOffers) ? allOffers.filter((o) => appIds.has(o.applicationId)) : [];
      setOffers(matched);
    } catch (err: unknown) {
      setOffersError((err as Error).message || 'Failed to load offers.');
    } finally {
      setOffersLoading(false);
    }
  };

  const retryOffers = async () => {
    const appIds = new Set(applications.map((a) => a.id));
    await retryOffersWithAppIds(appIds);
  };

  // ─── Actions: Apply & Tags ────────────────────────────────────

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !selectedVacancyId) return;

    setApplySubmitting(true);
    setApplyError(null);
    try {
      await postApi('/applications', {
        candidateId: id,
        vacancyId: selectedVacancyId,
      });
      setIsApplyModalOpen(false);
      void loadAllData();
    } catch (err: unknown) {
      setApplyError((err as Error).message || 'Failed to submit application.');
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleAddTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !candidate || !newTag.trim()) return;

    setTagSubmitting(true);
    setTagError(null);
    const trimmed = newTag.trim();
    const currentSkills = candidate.skills ?? [];
    const updatedSkills = currentSkills.includes(trimmed)
      ? currentSkills
      : [...currentSkills, trimmed];

    try {
      const updated = await patchApi<Candidate>(`/candidates/${id}`, {
        skills: updatedSkills,
      });
      setCandidate(updated);
      setNewTag('');
      setIsTagModalOpen(false);
    } catch (err: unknown) {
      setTagError((err as Error).message || 'Failed to add candidate tag.');
    } finally {
      setTagSubmitting(false);
    }
  };

  // ─── Root Loading / Error Views ──────────────────────────────

  if (candidateLoading) {
    return (
      <PageFrame eyebrow="Talent Operations" title="Candidate Profile" description="Candidate identity directory.">
        <PageState kind="loading" title="Loading candidate" description="Fetching candidate profile and records." />
      </PageFrame>
    );
  }

  const isForbidden =
    candidateError?.toLowerCase().includes('denied') ||
    candidateError?.toLowerCase().includes('permission') ||
    candidateError?.includes('403');

  if (candidateError || !candidate) {
    return (
      <PageFrame eyebrow="Talent Operations" title="Candidate Profile" description="Candidate identity directory.">
        {isForbidden ? (
          <PageState
            kind="forbidden"
            title="Access Restricted"
            description="You do not have the required permissions to view this candidate profile."
            actionLabel="Back to Candidates"
            onAction={() => navigate('/candidates')}
          />
        ) : (
          <PageState
            kind="not-found"
            title="Candidate Not Found"
            description="The requested candidate profile does not exist or has been removed."
            actionLabel="Back to Candidates"
            onAction={() => navigate('/candidates')}
          />
        )}
      </PageFrame>
    );
  }

  // ─── Candidate Workspace Props ────────────────────────────────

  const fullName =
    [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'Candidate';

  const activeApplication =
    applications.find((app) => app.stage !== 'Rejected' && app.stage !== 'Withdrawn') ??
    applications[0] ??
    null;

  // ─── Tab Item Definitions ─────────────────────────────────────

  const tabItems: TabItem[] = [
    { key: 'overview', label: 'Overview', controls: 'tabpanel-overview' },
    { key: 'applications', label: 'Applications', count: applications.length, controls: 'tabpanel-applications' },
    { key: 'interviews', label: 'Interviews', count: interviews.length, controls: 'tabpanel-interviews' },
    { key: 'offers', label: 'Offers', count: offers.length, controls: 'tabpanel-offers' },
    { key: 'timeline', label: 'Timeline', controls: 'tabpanel-timeline' },
  ];

  // ─── Overview Details (P0.2: Null fields hidden, not fallback strings) ───

  const contactItems: DetailSummaryItem[] = [];
  if (candidate.email) {
    contactItems.push({ label: 'Email', value: candidate.email, icon: <Icon name="mail" size={14} /> });
  }
  if (candidate.phone) {
    contactItems.push({ label: 'Phone', value: candidate.phone, icon: <Icon name="phone" size={14} /> });
  }
  if (candidate.location) {
    contactItems.push({ label: 'Location', value: candidate.location, icon: <Icon name="map-pin" size={14} /> });
  }
  if (candidate.currentTitle) {
    contactItems.push({ label: 'Current Role', value: candidate.currentTitle, icon: <Icon name="briefcase" size={14} /> });
  }
  if (candidate.currentCompany) {
    contactItems.push({ label: 'Current Company', value: candidate.currentCompany, icon: <Icon name="building" size={14} /> });
  }
  if (candidate.experienceYears != null) {
    contactItems.push({ label: 'Experience', value: `${candidate.experienceYears} years`, icon: <Icon name="clock" size={14} /> });
  }
  if (candidate.source) {
    contactItems.push({ label: 'Source / Channel', value: candidate.source, icon: <Icon name="inbox" size={14} /> });
  }
  if (candidate.consentStatus) {
    contactItems.push({ label: 'Consent Status', value: `${candidate.consentStatus} · Recorded`, icon: <Icon name="check-circle" size={14} /> });
  }
  if (candidate.consentCapturedAt) {
    contactItems.push({ label: 'Consent Captured', value: new Date(candidate.consentCapturedAt).toLocaleDateString(), icon: <Icon name="check-circle" size={14} /> });
  }
  if (candidate.consentSource) {
    contactItems.push({ label: 'Consent Source', value: candidate.consentSource, icon: <Icon name="document" size={14} /> });
  }
  if (candidate.availability) {
    contactItems.push({ label: 'Availability', value: candidate.availability, icon: <Icon name="calendar" size={14} /> });
  }
  if (candidate.createdAt) {
    contactItems.push({ label: 'Profile Created', value: new Date(candidate.createdAt).toLocaleDateString(), icon: <Icon name="clock" size={14} /> });
  }

  // ─── Table Columns Definitions ────────────────────────────────

  const applicationColumns: ResponsiveDataColumn<Application>[] = [
    {
      key: 'position',
      header: 'Position Title',
      priority: 'primary',
      render: (app) => (
        <div>
          <div className="font-bold text-rf-ink">{app.positionTitle || 'Position not specified'}</div>
          {app.vacancyCode && <div className="text-xs text-rf-ink-muted">{app.vacancyCode}</div>}
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      priority: 'secondary',
      render: (app) => <StatusBadge status={app.stage} />,
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'secondary',
      render: (app) => (
        app.stage === 'Rejected' || app.stage === 'Withdrawn' ? (
          <Badge variant="neutral">Closed</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        )
      ),
    },
    {
      key: 'date',
      header: 'Applied Date',
      priority: 'secondary',
      render: (app) => (
        <span className="text-rf-ink-muted font-medium">
          {new Date(app.appliedAt || app.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      priority: 'secondary',
      render: (app) => (
        <Button variant="secondary" size="sm" asChild>
          <Link to={`/applications/${app.id}`}>View application</Link>
        </Button>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────

  return (
    <PageFrame
      eyebrow={`Talent / Candidates / ${candidate.candidateCode || ''}`}
      title={fullName}
      description={
        candidate.currentTitle
          ? `${candidate.currentTitle}${candidate.currentCompany ? ` at ${candidate.currentCompany}` : ''}`
          : undefined
      }
      actions={
        <>
          <StatusBadge status={candidate.status} />
          <Button variant="primary" size="sm" onClick={() => setIsApplyModalOpen(true)}>
            <Icon name="plus" size={13} />
            Assign to Vacancy
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/candidates/${candidate.id}/documents`}>
              <Icon name="file-text" size={13} />
              Documents
            </Link>
          </Button>
        </>
      }
    >
      {/* Candidate 360 Workspace Header */}
      <CandidateWorkspace
        candidateName={fullName}
        positionTitle={activeApplication?.positionTitle ?? candidate.currentTitle ?? null}
        applicationId={activeApplication?.id ?? null}
        stage={activeApplication?.stage ?? null}
        stages={['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined']}
        slaDeadline={null}
        tags={candidate.skills ?? []}
        email={candidate.email || null}
        phone={candidate.phone || null}
        location={candidate.location || null}
        onAddTag={() => setIsTagModalOpen(true)}
      />

      {/* Tabs Navigation */}
      <Tabs
        ariaLabel="Candidate 360 view sections"
        items={tabItems}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
      />

      {/* Tab Panels */}
      <div className="mt-2">
        {/* Overview Tab */}
        <TabPanel id="overview" activeKey={activeTab}>
          {candidateLoading ? (
            <DetailSkeleton />
          ) : candidateError ? (
            <Alert
              tone="danger"
              title="Failed to load overview"
              action={
                <Button variant="secondary" size="sm" onClick={() => void loadAllData()}>
                  Retry
                </Button>
              }
            >
              {candidateError}
            </Alert>
          ) : contactItems.length === 0 ? (
            <PageState
              kind="empty"
              title="No details recorded"
              description="No contact or profile details have been recorded for this candidate."
            />
          ) : (
            <div className="flex flex-col gap-6">
              {candidate.currentTitle && (
                <div className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
                  <div className="pb-3 border-b border-rf-border-subtle mb-3">
                    <h3 className="text-xs font-bold text-rf-ink m-0">Professional Summary</h3>
                  </div>
                  <p className="text-xs text-rf-ink leading-relaxed m-0">
                    {candidate.currentTitle}
                    {candidate.currentCompany ? ` at ${candidate.currentCompany}` : ''}
                  </p>
                </div>
              )}
              <DetailSummary
                title="Contact & Profile Information"
                description="Sensitive contact details, acquisition channel, and data consent status."
                items={contactItems}
              />
            </div>
          )}
        </TabPanel>

        {/* Applications Tab */}
        <TabPanel id="applications" activeKey={activeTab}>
          {applicationsLoading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : applicationsError ? (
            <Alert
              tone="danger"
              title="Failed to load applications"
              action={
                <Button variant="secondary" size="sm" onClick={() => void retryApplications()}>
                  Retry
                </Button>
              }
            >
              {applicationsError}
            </Alert>
          ) : applications.length === 0 ? (
            <PageState
              kind="empty"
              title="No applications"
              description="This candidate has not applied to any vacancies yet."
              actionLabel="Assign to Vacancy"
              onAction={() => setIsApplyModalOpen(true)}
            />
          ) : (
            <div className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
              <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-rf-ink m-0">Applications ({applications.length})</h3>
                  <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">
                    Complete application history across all vacancies.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setIsApplyModalOpen(true)}>
                  <Icon name="plus" size={13} />
                  Assign to Vacancy
                </Button>
              </div>
              <ResponsiveDataView
                rows={applications}
                columns={applicationColumns}
                rowKey={(app) => app.id}
                label="Candidate applications table"
              />
            </div>
          )}
        </TabPanel>

        {/* Interviews Tab */}
        <TabPanel id="interviews" activeKey={activeTab}>
          {interviewsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TableSkeleton rows={2} columns={3} />
              <TableSkeleton rows={2} columns={3} />
            </div>
          ) : interviewsError ? (
            <Alert
              tone="danger"
              title="Failed to load interviews"
              action={
                <Button variant="secondary" size="sm" onClick={() => void retryInterviews()}>
                  Retry
                </Button>
              }
            >
              {interviewsError}
            </Alert>
          ) : interviews.length === 0 ? (
            <PageState
              kind="empty"
              title="No interviews"
              description="No interviews have been scheduled for this candidate."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl border border-rf-border-subtle bg-rf-surface-subtle flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-rf-ink m-0">Interviews ({interviews.length})</h3>
                  <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">
                    Recorded interview rounds and scorecard evaluations.
                  </p>
                </div>
                {/* Tab header shows Strong Hire/Hire/No Hire counts */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">{interviewStats.strongHire} Strong Hire</Badge>
                  <Badge variant="info">{interviewStats.hire} Hire</Badge>
                  <Badge variant="danger">{interviewStats.noHire} No Hire</Badge>
                  {interviewStats.pending > 0 && (
                    <Badge variant="neutral">{interviewStats.pending} Pending feedback</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list" aria-label="Candidate interview scorecards">
                {interviews.map((intv) => {
                  const hasScorecards = Boolean(intv.scorecards && intv.scorecards.length > 0);
                  const agg = aggregateInterviewScorecards(intv.scorecards);
                  const formattedDate = intv.scheduledStart
                    ? new Date(intv.scheduledStart).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unscheduled';

                  const interviewerName =
                    agg.interviewerNames ||
                    intv.attendees?.map((a) => a.userName).filter(Boolean).join(', ') ||
                    'Interviewer';

                  if (hasScorecards && agg.recommendation) {
                    return (
                      <div key={intv.id} role="listitem">
                        <ScorecardSummary
                          interviewId={intv.id}
                          interviewTitle={intv.title || `${intv.interviewType} Interview`}
                          interviewDate={formattedDate}
                          interviewerName={interviewerName}
                          recommendation={agg.recommendation}
                          averageRating={agg.averageRating}
                          isLocked={agg.isLocked}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={intv.id} role="listitem">
                      <ScorecardSummary
                        interviewId={intv.id}
                        interviewTitle={intv.title || `${intv.interviewType} Interview`}
                        interviewDate={formattedDate}
                        interviewerName={interviewerName}
                        recommendation={null}
                        averageRating={null}
                        isLocked={false}
                        pendingLabel="Pending feedback"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabPanel>

        {/* Offers Tab */}
        <TabPanel id="offers" activeKey={activeTab}>
          {offersLoading ? (
            <ListSkeleton count={3} />
          ) : offersError ? (
            <Alert
              tone="danger"
              title="Failed to load offers"
              action={
                <Button variant="secondary" size="sm" onClick={() => void retryOffers()}>
                  Retry
                </Button>
              }
            >
              {offersError}
            </Alert>
          ) : offers.length === 0 ? (
            <PageState
              kind="empty"
              title="No offers"
              description="No offers have been generated for this candidate."
            />
          ) : (
            <div className="flex flex-col gap-3" role="list" aria-label="Candidate offers list">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  role="listitem"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-rf-border-subtle bg-white shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-rf-surface-subtle text-rf-ink-muted border border-rf-border-subtle shrink-0">
                      <Icon name="offer" size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-rf-ink">{offer.offerCode}</span>
                        <StatusBadge status={offer.status} />
                      </div>
                      <p className="text-xs text-rf-ink-muted font-medium m-0 mt-0.5">
                        {offer.positionTitle ? `${offer.positionTitle} · ` : ''}
                        Created {new Date(offer.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/offers/${offer.id}`}>View Offer</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabPanel>

        {/* Timeline Tab */}
        <TabPanel id="timeline" activeKey={activeTab}>
          <PageState
            kind="empty"
            title="Activity Timeline"
            description="Activity feed coming in Phase 2"
          />
        </TabPanel>
      </div>

      {/* Assign to Vacancy Modal */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Assign Candidate to Vacancy">
        <form onSubmit={(e) => void handleApply(e)}>
          {applyError && (
            <div className="mb-4">
              <Alert tone="danger" title="Application failed">
                {applyError}
              </Alert>
            </div>
          )}
          <FormField id="apply-vacancy" label="Select Vacancy" required hint="Choose an open vacancy to link this candidate.">
            <Select
              id="apply-vacancy"
              required
              value={selectedVacancyId}
              onChange={(e) => setSelectedVacancyId(e.target.value)}
            >
              {vacancies.length === 0 ? (
                <option value="">No open vacancies available</option>
              ) : (
                vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.position?.title || v.vacancyCode} ({v.status})
                  </option>
                ))
              )}
            </Select>
          </FormField>
          <div className="flex items-center justify-end gap-2 mt-5">
            <Button variant="ghost" type="button" onClick={() => setIsApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={applySubmitting}
              loadingLabel="Linking candidate"
              type="submit"
              disabled={vacancies.length === 0}
            >
              Link application
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Tag Modal */}
      <Modal isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)} title="Add Candidate Tag">
        <form onSubmit={(e) => void handleAddTag(e)}>
          {tagError && (
            <div className="mb-4">
              <Alert tone="danger" title="Tag update failed">
                {tagError}
              </Alert>
            </div>
          )}
          <FormField id="candidate-tag" label="Tag / Skill" required hint="Add a skill or tag for candidate search and filtering.">
            <Input
              id="candidate-tag"
              type="text"
              required
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="e.g. React, Python, Project Management"
              autoFocus
            />
          </FormField>
          <div className="flex items-center justify-end gap-2 mt-5">
            <Button variant="ghost" type="button" onClick={() => setIsTagModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={tagSubmitting} loadingLabel="Adding tag" type="submit">
              Add Tag
            </Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
