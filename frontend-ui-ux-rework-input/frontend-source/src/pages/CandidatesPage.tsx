import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';
import { fetchApi, postApi } from '../api/client';
import { getInitials } from '../utils/format';
import {
  Alert,
  Button,
  DataToolbar,
  FilterChip,
  FormField,
  Input,
  Modal,
  PageFrame,
  PageState,
  Pagination,
  ResponsiveDataView,
  Select,
  StatusBadge,
  TableSkeleton,
  Tabs,
  type ResponsiveDataColumn,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { confirmDiscardChanges, useUnsavedChanges } from '../hooks/useUnsavedChanges';
import './PageEnhancementsV2.css';

interface CandidateForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentCompany: string;
  source: string;
}

const initialForm: CandidateForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentTitle: '',
  currentCompany: '',
  source: 'Direct Sourcing',
};

export function CandidatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateCandidate = Boolean(user?.permissions.includes('CANDIDATE_CREATE'));
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Candidate Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState<CandidateForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    if (canCreateCandidate) setIsAddModalOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canCreateCandidate, searchParams, setSearchParams]);

  const isFormDirty = form.firstName !== initialForm.firstName
    || form.lastName !== initialForm.lastName
    || form.email !== initialForm.email
    || form.phone !== initialForm.phone
    || form.currentTitle !== initialForm.currentTitle
    || form.currentCompany !== initialForm.currentCompany
    || form.source !== initialForm.source;
  useUnsavedChanges(isAddModalOpen && isFormDirty && !isSubmitting);

  const closeCandidateModal = () => {
    if (isSubmitting || !confirmDiscardChanges(isFormDirty)) return;
    setIsAddModalOpen(false);
    setForm(initialForm);
    setFormError('');
  };

  const load = async (requestedPage = page) => {
    setIsLoading(true);
    setError('');
    try {
      let queryUrl = `/candidates?page=${requestedPage}&pageSize=${pageSize}`;
      if (statusFilter !== 'All') {
        queryUrl += `&status=${encodeURIComponent(statusFilter)}`;
      }
      if (sourceFilter !== 'All') {
        queryUrl += `&source=${encodeURIComponent(sourceFilter)}`;
      }
      if (search.trim()) {
        queryUrl += `&search=${encodeURIComponent(search.trim())}`;
      }
      const response = await fetchApi<PaginatedResult<Candidate>>(queryUrl);
      setCandidates(response.data);
      setTotalCount(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load candidates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, statusFilter, sourceFilter]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load(1);
  };

  const handleCreateCandidate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Pre-submission validation
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCandidate = await postApi<Candidate>('/candidates', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        currentTitle: form.currentTitle.trim() || undefined,
        currentCompany: form.currentCompany.trim() || undefined,
        source: form.source.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setForm(initialForm);
      setSuccessFeedback(`Candidate ${newCandidate.firstName} ${newCandidate.lastName} created successfully.`);
      setTimeout(() => setSuccessFeedback(''), 4000);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create candidate.';
      if (msg.includes('already exists') || msg.includes('Conflict')) {
        setFormError(`A candidate with email ${form.email} already exists in your organization.`);
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const sources = useMemo(() => {
    const list = Array.from(new Set(candidates.map((c) => c.source).filter(Boolean)));
    return ['All', ...list];
  }, [candidates]);

  const candidateColumns = useMemo<ResponsiveDataColumn<Candidate>[]>(() => [
    {
      key: 'candidate',
      header: 'Candidate',
      priority: 'primary',
      render: (candidate) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rf-action/15 bg-rf-action-soft text-xs font-extrabold text-rf-action">
            {getInitials(`${candidate.firstName} ${candidate.lastName}`)}
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-xs font-extrabold text-rf-ink">{candidate.firstName} {candidate.lastName}</strong>
            <span className="block truncate text-[10.5px] font-medium text-rf-ink-muted">{candidate.email}{candidate.phone ? ` · ${candidate.phone}` : ''}</span>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (candidate) => <span className="rounded-md bg-rf-surface-subtle px-2 py-0.5 font-mono text-[10.5px] font-bold text-rf-ink-muted">{candidate.candidateCode || 'Not assigned'}</span> },
    {
      key: 'role',
      header: 'Current role & company',
      render: (candidate) => (
        <span className="grid gap-0.5">
          <strong className="text-[11px] text-rf-ink">{candidate.currentTitle || 'Role not specified'}</strong>
          <span className="text-[10.5px] font-medium text-rf-ink-muted">{candidate.currentCompany || 'Company not specified'}</span>
        </span>
      ),
    },
    { key: 'source', header: 'Source', priority: 'tertiary', render: (candidate) => candidate.source || 'Not reported' },
    { key: 'status', header: 'Status', render: (candidate) => <StatusBadge status={candidate.status} /> },
    { key: 'created', header: 'Created', priority: 'tertiary', render: (candidate) => new Date(candidate.createdAt).toLocaleDateString() },
  ], []);

  return (
    <PageFrame
      eyebrow="Talent Operations"
      title="Candidate Database"
      description="Manage unique candidate identities independently from job applications."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {canCreateCandidate && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsAddModalOpen(true)}>
                <Icon name="plus" size={13} />
                Add candidate
              </Button>
              <Button variant="primary" size="sm" asChild>
                <Link to="/cv-intake">
                  <Icon name="upload" size={13} />
                  Import CVs
                </Link>
              </Button>
            </>
          )}
        </>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Candidates could not be loaded"
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

      {successFeedback && (
        <div className="mb-4">
          <Alert tone="success" title="Candidate Created">
            {successFeedback}
          </Alert>
        </div>
      )}

      <Tabs
        ariaLabel="Candidate views"
        activeKey={statusFilter === 'Blacklisted' ? 'disqualified' : 'all'}
        items={[
          { key: 'all', label: 'All Candidates' },
          { key: 'talent-pool', label: 'Talent Pool' },
          { key: 'disqualified', label: 'Disqualified' },
        ]}
        onChange={(key) => {
          if (key === 'talent-pool') {
            navigate('/talent-pool');
            return;
          }
          setStatusFilter(key === 'disqualified' ? 'Blacklisted' : 'All');
          setPage(1);
        }}
      />

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-[var(--shadow-card)]">
        <form aria-label="Candidate filters" onSubmit={handleSearchSubmit}>
          <DataToolbar
            search={
              <Input
                aria-label="Search candidates"
                placeholder="Search name, email, company, code..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            }
            filters={
              <>
                <Select
                  className="sm:w-44"
                  aria-label="Filter candidates by status"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="All">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Blacklisted">Blacklisted</option>
                  <option value="Archived">Archived</option>
                </Select>
                <Select
                  className="sm:w-44"
                  aria-label="Filter candidates by source"
                  value={sourceFilter}
                  onChange={(event) => {
                    setSourceFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  {sources.map((s) => (
                    <option key={s || 'all'} value={s || ''}>
                      {s === 'All' ? 'All sources' : s}
                    </option>
                  ))}
                </Select>
              </>
            }
            actions={
              <Button variant="secondary" size="sm" type="submit">
                <Icon name="search" size={13} />
                Search
              </Button>
            }
            activeFilters={
              statusFilter !== 'All' || sourceFilter !== 'All' ? (
                <>
                  {statusFilter !== 'All' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => { setStatusFilter('All'); setPage(1); }} />}
                  {sourceFilter !== 'All' && <FilterChip label={`Source: ${sourceFilter}`} onRemove={() => { setSourceFilter('All'); setPage(1); }} />}
                </>
              ) : undefined
            }
          />
        </form>

        {isLoading ? (
          <div className="p-3 sm:p-4"><TableSkeleton rows={5} columns={6} /></div>
        ) : (
          <div className="p-3 sm:p-4">
            <ResponsiveDataView
              rows={candidates}
              columns={candidateColumns}
              rowKey={(candidate) => candidate.id}
              label="Candidate directory"
              onRowClick={(candidate) => navigate(`/candidates/${candidate.id}`)}
              renderActions={(candidate) => (
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/candidates/${candidate.id}`}>Open</Link>
                </Button>
              )}
              emptyState={<PageState kind="empty" title="No matching candidates" description="Adjust the filters or create a new candidate." />}
            />
          </div>
        )}

        {totalCount > pageSize && (
          <Pagination
            ariaLabel="Candidate result pages"
            currentPage={page}
            totalPages={Math.ceil(totalCount / pageSize)}
            onPageChange={setPage}
            disabled={isLoading}
            summary={`Showing ${candidates.length} of ${totalCount} candidates`}
          />
        )}
      </section>

      {/* Add Candidate Modal */}
      {isAddModalOpen && canCreateCandidate && (
        <Modal
          isOpen={isAddModalOpen}
          title="Add New Candidate"
          onClose={closeCandidateModal}
          maxWidthClass="max-w-2xl"
        >
          <div className="rf-candidate-modal">
            <div className="rf-candidate-modal__intro">
              <div className="rf-candidate-modal__intro-icon" aria-hidden="true">
                <Icon name="user-check" size={19} />
              </div>
              <div className="min-w-0">
                <div className="rf-candidate-modal__eyebrow">Candidate directory</div>
                <h3>Create a candidate record</h3>
                <p>Add the candidate’s identity first, then capture the professional context your hiring team needs.</p>
              </div>
              <span className="rf-candidate-modal__required">* Required</span>
            </div>

            {formError && (
              <div className="rf-candidate-modal__error">
                <Alert tone="danger" title="Please review the form">
                  {formError}
                </Alert>
              </div>
            )}

            <form className="rf-candidate-modal__form" onSubmit={(e) => void handleCreateCandidate(e)}>
              <section className="rf-candidate-modal__section" aria-labelledby="candidate-identity-heading">
                <div className="rf-candidate-modal__section-heading">
                  <span className="rf-candidate-modal__section-number">01</span>
                  <div>
                    <h4 id="candidate-identity-heading">Identity & contact</h4>
                    <p>Use a unique email to prevent duplicate candidate records.</p>
                  </div>
                </div>
                <div className="rf-candidate-modal__fields rf-candidate-modal__fields--identity">
                  <FormField id="cand-fname" label="First Name" required>
                    <Input
                      id="cand-fname"
                      required
                      placeholder="e.g. Sara"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </FormField>

                  <FormField id="cand-lname" label="Last Name" required>
                    <Input
                      id="cand-lname"
                      required
                      placeholder="e.g. Ahmed"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </FormField>

                  <FormField id="cand-email" label="Email Address" required hint="Used for duplicate checking across the organization.">
                    <Input
                      id="cand-email"
                      type="email"
                      required
                      placeholder="e.g. sara.ahmed@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </FormField>

                  <FormField id="cand-phone" label="Phone Number">
                    <Input
                      id="cand-phone"
                      placeholder="e.g. +20 100 000 0000"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </FormField>
                </div>
              </section>

              <section className="rf-candidate-modal__section" aria-labelledby="candidate-context-heading">
                <div className="rf-candidate-modal__section-heading">
                  <span className="rf-candidate-modal__section-number">02</span>
                  <div>
                    <h4 id="candidate-context-heading">Professional context</h4>
                    <p>Give recruiters a useful starting point for future matching.</p>
                  </div>
                </div>
                <div className="rf-candidate-modal__fields rf-candidate-modal__fields--context">
                  <FormField id="cand-title" label="Current Job Title">
                    <Input
                      id="cand-title"
                      placeholder="e.g. Senior Backend Engineer"
                      value={form.currentTitle}
                      onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
                    />
                  </FormField>

                  <FormField id="cand-company" label="Current Company">
                    <Input
                      id="cand-company"
                      placeholder="e.g. Acme Corp"
                      value={form.currentCompany}
                      onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                    />
                  </FormField>

                  <FormField id="cand-source" label="Candidate Source">
                    <Select
                      id="cand-source"
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                    >
                      <option value="Direct Sourcing">Direct Sourcing</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Employee Referral">Employee Referral</option>
                      <option value="Career Portal">Career Portal</option>
                      <option value="Agency">Agency</option>
                      <option value="Campus Recruitment">Campus Recruitment</option>
                    </Select>
                  </FormField>
                </div>
              </section>

              <div className="rf-candidate-modal__footer">
                <p className="rf-candidate-modal__footer-note"><Icon name="info" size={14} /> You can add applications and documents after creating the profile.</p>
                <div className="rf-candidate-modal__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={isSubmitting}
                    onClick={closeCandidateModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    loading={isSubmitting}
                    loadingLabel="Creating..."
                  >
                    Create Candidate
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </PageFrame>
  );
}
