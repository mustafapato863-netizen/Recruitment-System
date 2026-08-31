import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { getApi, postApi } from '../api/client';
import type { Interview, Application, UserRecord } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { CheckboxField } from '../components/ui/CheckboxField';
import { MetricCard } from '../components/ui/MetricCard';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { Select } from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { InterviewWorkspaceNav } from '../components/ui/InterviewWorkspaceNav';
import './PageEnhancementsV2.css';

const interviewColumns: ResponsiveDataColumn<Interview>[] = [
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (item) => (
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-rf-action/15 bg-rf-action-soft text-rf-action">
          <Icon name="users" size={14} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-rf-ink">{item.candidateName || 'Candidate'}</div>
          <div className="truncate text-[11px] font-medium text-rf-ink-muted">{item.interviewCode}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'position',
    header: 'Vacancy / Role',
    priority: 'secondary',
    render: (item) => <span className="font-medium text-rf-ink">{item.positionTitle || 'Position'}</span>,
  },
  {
    key: 'round',
    header: 'Round',
    priority: 'tertiary',
    render: (item) => <span className="font-semibold text-rf-ink">{item.title}</span>,
  },
  {
    key: 'scheduled',
    header: 'Date & time',
    priority: 'secondary',
    render: (item) => (
      <div>
        <div className="font-bold text-rf-ink">{new Date(item.scheduledStart).toLocaleDateString()}</div>
        <div className="text-[11px] font-medium text-rf-ink-muted">{new Date(item.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    priority: 'tertiary',
    render: (item) => <Badge variant="neutral">{item.interviewType}</Badge>,
  },
  {
    key: 'feedback',
    header: 'Feedback',
    priority: 'secondary',
    render: (item) => {
      const complete = (item.scorecards?.length || 0) > 0;
      return <Badge variant={complete ? 'success' : 'warning'}>{item.scorecards?.length || 0}/{item.attendees?.length || 1}</Badge>;
    },
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (item) => <StatusBadge status={item.status} />,
  },
];

export function InterviewsPage() {
  const { user } = useAuth();
  const canSchedule = Boolean(user?.permissions.includes('APPLICATION_MOVE_STAGE'));
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    applicationId: '',
    title: 'Technical Evaluation Round',
    interviewType: 'Technical' as Interview['interviewType'],
    scheduledStart: '',
    scheduledEnd: '',
    timezone: 'UTC',
    locationUrl: '',
    attendeeUserIds: [] as string[],
  });

  const fetchInterviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ints, appsRes, usersRes] = await Promise.all([
        getApi<Interview[]>(`/interviews`),
        getApi<{ data: Application[] }>('/applications'),
        getApi<UserRecord[]>('/users/interviewers'),
      ]);
      setInterviews(ints);
      setApplications(appsRes.data);
      setUsers(usersRes);
    } catch (err: unknown) {
      setInterviews([]);
      setApplications([]);
      setUsers([]);
      setError(err instanceof Error ? err.message : 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInterviews();
  }, []);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || loading) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });

    if (!error && canSchedule && applications.length > 0 && users.length > 0) {
      setIsScheduleModalOpen(true);
    }
  }, [applications.length, canSchedule, error, loading, searchParams, setSearchParams, users.length]);

  const filtered = useMemo(() => interviews.filter((i) => {
    const searchable = `${i.interviewCode} ${i.title} ${i.candidateName} ${i.positionTitle}`.toLowerCase();
    return (!search || searchable.includes(search.toLowerCase())) && (!statusFilter || i.status === statusFilter);
  }), [interviews, search, statusFilter]);

  const handleSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.applicationId || !formData.scheduledStart || !formData.scheduledEnd) return;
    setSubmitting(true);
    setFormError(null);

    try {
      await postApi('/interviews', {
        ...formData,
        scheduledStart: new Date(formData.scheduledStart).toISOString(),
        scheduledEnd: new Date(formData.scheduledEnd).toISOString(),
      });
      setIsScheduleModalOpen(false);
      await fetchInterviews();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to schedule interview.');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduledCount = interviews.filter((i) => i.status === 'Scheduled').length;
  const completedCount = interviews.filter((i) => i.status === 'Completed').length;
  const pendingFeedback = interviews.filter((i) => (i.scorecards?.length || 0) < (i.attendees?.length || 1)).length;

  return (
    <PageFrame
      eyebrow="Recruitment Operations"
      title="Interview Management"
      description="Schedule, coordinate and track all candidate interview rounds and scorecards."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void fetchInterviews()}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Unable to load interviews"
          action={
            <Button variant="secondary" size="sm" onClick={() => void fetchInterviews()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <InterviewWorkspaceNav canSchedule={canSchedule && !error && applications.length > 0 && users.length > 0} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Scheduled Sessions" value={scheduledCount} detail="Upcoming rounds" tone="action" icon={<Icon name="calendar" size={14} />} />
        <MetricCard label="Completed" value={completedCount} detail="Evaluations conducted" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Feedback Pending" value={pendingFeedback} detail="Requires interviewer notes" tone="warning" icon={<Icon name="alert-triangle" size={14} />} />
        <MetricCard label="Total Interviews" value={interviews.length} detail="Across all vacancies" tone="info" icon={<Icon name="users" size={14} />} />
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search interviews"
              placeholder="Search candidate, role or interview ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter interviews by status">
              {['', 'Scheduled', 'Completed', 'Cancelled'].map((status) => (
                <FilterChip
                  key={status || 'all'}
                  label={status || 'All statuses'}
                  isActive={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                />
              ))}
            </div>
          )}
          activeFilters={statusFilter ? <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} /> : undefined}
        />

        {loading ? (
          <TableSkeleton columns={8} rows={6} />
        ) : filtered.length === 0 ? (
          <PageState
            kind="empty"
            title="No matching interviews"
            description="Adjust your search or schedule a new interview round."
          />
        ) : (
          <ResponsiveDataView
            rows={filtered}
            columns={interviewColumns}
            rowKey={(item) => item.id}
            label="Interviews"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(item) => (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/interviews/${item.id}`}>Open scorecard</Link>
              </Button>
            )}
          />
        )}
      </section>

      {/* Schedule Interview Modal */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Schedule Candidate Interview">
        <form onSubmit={(e) => void handleSchedule(e)}>
          {formError && (
            <div className="mb-4">
              <Alert tone="danger" title="Scheduling error">
                {formError}
              </Alert>
            </div>
          )}
          <div className="form-grid">
            <FormField id="int-app" label="Select Application / Candidate" required>
              <Select
                id="int-app"
                required
                value={formData.applicationId}
                onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
              >
                <option value="">Choose an application</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : 'Candidate'} - {app.positionTitle || 'Position'}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="int-title" label="Interview Title / Round" required>
              <Input
                id="int-title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </FormField>
            <FormField id="int-type" label="Interview Type">
              <Select
                id="int-type"
                value={formData.interviewType}
                onChange={(e) => setFormData({ ...formData, interviewType: e.target.value as Interview['interviewType'] })}
              >
                <option value="Screening">Screening Round</option>
                <option value="Technical">Technical Round</option>
                <option value="Behavioral">Behavioral / Culture</option>
                <option value="Managerial">Managerial Round</option>
                <option value="Executive">Executive / Final</option>
              </Select>
            </FormField>
            <FormField id="int-loc" label="Meeting Link / Location">
              <Input
                id="int-loc"
                placeholder="e.g. Google Meet URL or Office Room"
                value={formData.locationUrl}
                onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
              />
            </FormField>
            <FormField id="int-start" label="Start Date &amp; Time" required>
              <Input
                id="int-start"
                required
                type="datetime-local"
                value={formData.scheduledStart}
                onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
              />
            </FormField>
            <FormField id="int-end" label="End Date &amp; Time" required>
              <Input
                id="int-end"
                required
                type="datetime-local"
                value={formData.scheduledEnd}
                onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
              />
            </FormField>
            <div className="full-field">
              <FormField id="int-attendees" label="Interviewers (Attendees)" hint="Select team members who will conduct the interview.">
                <div className="flex flex-col gap-2 mt-2">
                  {users.map((u) => (
                    <CheckboxField
                      key={u.id}
                      label={`${u.displayName} (${u.email})`}
                      checked={formData.attendeeUserIds.includes(u.id)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setFormData((prev) => ({
                          ...prev,
                          attendeeUserIds: isChecked
                            ? [...prev.attendeeUserIds, u.id]
                            : prev.attendeeUserIds.filter(id => id !== u.id)
                        }));
                      }}
                    />
                  ))}
                </div>
              </FormField>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} loadingLabel="Scheduling" type="submit">
              Confirm interview
            </Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
