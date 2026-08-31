import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VacancyCoreContext, VacancyRequest, VacancyRequestStatus } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { ResponsiveDataView } from '../components/ui/ResponsiveDataView';
import { Input } from '../components/ui/Input';
import { DataToolbar } from '../components/ui/DataToolbar';
import { Pagination } from '../components/ui/Pagination';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Select } from '../components/ui/Select';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

const PAGE_SIZE = 15;

function formatDate(value: string | null): string {
  if (!value) return 'Flexible';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRequestReason(value: string | null): string {
  if (!value) return 'Workforce request';
  return value.length > 76 ? `${value.slice(0, 73)}...` : value;
}

export function VacancyRequestsPage() {
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [context, setContext] = useState<VacancyCoreContext | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | VacancyRequestStatus>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setRequests(await fetchApi<VacancyRequest[]>('/vacancy-requests'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vacancy requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void fetchApi<VacancyCoreContext>('/vacancy-requests/context')
      .then(setContext)
      .catch(() => undefined);
  }, []);

  const getPositionLabel = (request: VacancyRequest) =>
    context?.positions?.find((position) => position.id === request.positionId)?.title ??
    (context?.position?.id === request.positionId ? context.position.title : request.positionId);

  const getBranchLabel = (request: VacancyRequest) =>
    context?.branches?.find((branch) => branch.id === request.branchId)?.name ??
    (context?.branch?.id === request.branchId ? context.branch.name : request.branchId);

  const filtered = useMemo(
    () =>
      requests.filter((request) => {
        const searchable = `${request.requestCode} ${getPositionLabel(request)} ${getBranchLabel(request)} ${request.reason || ''}`.toLowerCase();
        return (!search || searchable.includes(search.toLowerCase())) && (!status || request.status === status);
      }),
    [requests, search, status, context]
  );

  const count = (value: VacancyRequestStatus) => requests.filter((request) => request.status === value).length;

  const quickFilterTabs: Array<{ label: string; value: '' | VacancyRequestStatus; count: number }> = [
    { label: 'All Requests', value: '', count: requests.length },
    { label: 'Draft', value: 'Draft', count: count('Draft') },
    { label: 'Pending Approval', value: 'Pending Approval', count: count('Pending Approval') },
    { label: 'Changes Requested', value: 'Changes Requested', count: count('Changes Requested') },
    { label: 'Approved', value: 'Approved', count: count('Approved') },
    { label: 'Converted', value: 'Converted to Vacancy', count: count('Converted to Vacancy') },
  ];

  return (
    <PageFrame
      className="rf-vacancy-requests-page"
      eyebrow="Workforce & Openings"
      title="Vacancy Requests"
      description="Create, review and track workforce requisitions before they become active pipeline vacancies."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/approval-inbox">
              <Icon name="inbox" size={13} />
              Approval Inbox
            </Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link to="/vacancy-requests/create">
              <Icon name="plus" size={14} />
              Create Vacancy Request
            </Link>
          </Button>
        </>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Vacancy requests could not be loaded"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Top Demand Overview Bento Cards */}
      <section className="rf-request-overview" aria-labelledby="rf-request-overview-title">
        <div className="rf-request-overview__header">
          <div>
            <div className="rf-request-overview__eyebrow">Demand overview</div>
            <h2 id="rf-request-overview-title">Workforce demand</h2>
            <p>Track every requisition from initial draft through authorization and active vacancy launch.</p>
          </div>
          <div className="rf-request-overview__signal">
            <span className="rf-request-overview__signal-dot" aria-hidden="true" />
            <span>{count('Pending Approval') > 0 ? `${count('Pending Approval')} requisitions awaiting approval` : 'All requisitions up to date'}</span>
          </div>
        </div>

        <div className="rf-request-metrics grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 p-4 sm:p-5">
          <MetricCard
            label="Total Requisitions"
            value={requests.length}
            detail="All workforce requests"
            tone="action"
            icon={<Icon name="file-text" size={16} />}
          />
          <MetricCard
            label="Draft Stage"
            value={count('Draft')}
            detail="Owned by team"
            tone="neutral"
            icon={<Icon name="document" size={16} />}
          />
          <MetricCard
            label="Pending Approval"
            value={count('Pending Approval')}
            detail="Waiting for decision"
            tone="warning"
            icon={<Icon name="clock" size={16} />}
          />
          <MetricCard
            label="Changes Requested"
            value={count('Changes Requested')}
            detail="Modifications needed"
            tone="danger"
            icon={<Icon name="alert-triangle" size={16} />}
          />
          <MetricCard
            label="Approved & Ready"
            value={count('Approved')}
            detail="Ready for conversion"
            tone="success"
            icon={<Icon name="check-circle" size={16} />}
          />
        </div>
      </section>

      {/* Main Request Workspace Register */}
      <section className="rf-request-workspace" aria-labelledby="rf-request-workspace-title">
        <header className="rf-request-workspace__header">
          <div>
            <div className="rf-request-workspace__eyebrow">Request register</div>
            <h2 id="rf-request-workspace-title">Workforce Requisitions</h2>
            <p>Review demand, position specifications, location, timing, and approval gates in real time.</p>
          </div>
          <div className="rf-request-workspace__actions flex items-center gap-3">
            <span className="rf-request-workspace__count text-xs font-bold text-rf-ink-muted">
              {filtered.length} of {requests.length} visible
            </span>
          </div>
        </header>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-4 sm:px-6 pt-3 border-b border-rf-border-subtle">
          {quickFilterTabs.map((tab) => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-rf-action text-rf-on-action shadow-2xs'
                    : 'text-rf-ink-muted hover:text-rf-ink hover:bg-rf-surface-subtle bg-transparent border-0'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-rf-surface text-rf-action-strong' : 'bg-rf-surface-subtle text-rf-ink-muted border border-rf-border-subtle'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <DataToolbar className="rf-request-toolbar p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
          <Input
            className="min-w-0 flex-1"
            aria-label="Search vacancy requests"
            placeholder="Search by request code, role, department or branch..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
          />
          <Select
            className="sm:w-56"
            aria-label="Filter vacancy requests by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | VacancyRequestStatus);
              setCurrentPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {['Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Rejected', 'Cancelled', 'Converted to Vacancy'].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </DataToolbar>

        {isLoading ? (
          <div className="p-8">
            <PageState kind="loading" title="Loading vacancy requests" description="Fetching the latest workforce demand." />
          </div>
        ) : (
          <>
            <ResponsiveDataView<VacancyRequest>
              className="rf-request-data"
              label="Vacancy Requests"
              rows={filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
              emptyState={
                <div className="rf-request-empty p-8">
                  <PageState
                    kind="empty"
                    title="No matching requests found"
                    description="Adjust the search query, clear filters, or create a new vacancy request."
                    actionLabel="Create Vacancy Request"
                    actionHref="/vacancy-requests/create"
                  />
                </div>
              }
              columns={[
                {
                  key: 'requestCode',
                  header: 'Requisition',
                  priority: 'primary',
                  render: (request) => (
                    <div className="rf-request-cell flex items-center gap-3">
                      <span
                        className="rf-request-cell__icon w-8 h-8 rounded-lg bg-rf-action-soft text-rf-action flex items-center justify-center shrink-0 shadow-2xs"
                        aria-hidden="true"
                      >
                        <Icon name="file-text" size={15} />
                      </span>
                      <span className="rf-request-cell__copy flex flex-col min-w-0">
                        <strong className="text-xs font-bold text-rf-ink">{request.requestCode}</strong>
                        <span className="text-[11px] text-rf-ink-muted truncate">{formatRequestReason(request.reason)}</span>
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'position',
                  header: 'Role & Location',
                  priority: 'secondary',
                  render: (request) => (
                    <div className="rf-request-role flex flex-col">
                      <strong className="text-xs font-bold text-rf-ink">{getPositionLabel(request)}</strong>
                      <span className="text-[11px] text-rf-ink-muted inline-flex items-center gap-1">
                        <Icon name="building" size={11} />
                        {getBranchLabel(request)}
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'headcount',
                  header: 'Headcount',
                  priority: 'secondary',
                  render: (request) => (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rf-surface-subtle border border-rf-border-subtle">
                      <span className="text-xs font-black text-rf-ink tabular-nums">{request.requestedHeadcount}</span>
                      <span className="text-[10px] font-semibold text-rf-ink-muted uppercase">
                        {request.requestedHeadcount === 1 ? 'HC' : 'HC'}
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'targetStartDate',
                  header: 'Target Start',
                  priority: 'secondary',
                  render: (request) => (
                    <span className="text-xs font-medium text-rf-ink">{formatDate(request.targetStartDate)}</span>
                  ),
                },
                {
                  key: 'employmentType',
                  header: 'Type',
                  priority: 'tertiary',
                  render: (request) => (
                    <span className="text-xs font-medium text-rf-ink-muted">{request.employmentType || 'Full-time'}</span>
                  ),
                },
                {
                  key: 'criticality',
                  header: 'Priority',
                  priority: 'tertiary',
                  render: (request) =>
                    request.criticality ? (
                      <StatusBadge status={request.criticality} />
                    ) : (
                      <span className="text-xs text-rf-ink-muted">Normal</span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Approval Status',
                  priority: 'secondary',
                  render: (request) => <StatusBadge status={request.status} />,
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  priority: 'tertiary',
                  render: (request) => (
                    <span className="text-xs text-rf-ink-muted">{formatDate(request.createdAt)}</span>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  priority: 'primary',
                  render: (request) => (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/vacancy-requests/${request.id}`}>
                        View Requisition
                        <Icon name="chevron-right" size={13} />
                      </Link>
                    </Button>
                  ),
                },
              ]}
              rowKey={(r) => r.id}
            />
            {Math.ceil(filtered.length / PAGE_SIZE) > 1 && (
              <div className="rf-request-pagination p-4 border-t border-rf-border-subtle flex justify-end">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
                  onPageChange={setCurrentPage}
                  summary={`${filtered.length} total requisitions`}
                />
              </div>
            )}
          </>
        )}
      </section>
    </PageFrame>
  );
}

export default VacancyRequestsPage;
