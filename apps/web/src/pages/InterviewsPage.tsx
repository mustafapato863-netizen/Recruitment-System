import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { getApi, postApi } from '../api/client';
import type { Interview, Application, UserRecord, PaginatedResult } from '@recruitflow/contracts';

export function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    applicationId: '',
    title: '',
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
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const [ints, appsRes, usersRes] = await Promise.all([
        getApi<Interview[]>(`/interviews?${params.toString()}`),
        getApi<PaginatedResult<Application>>('/applications'),
        getApi<UserRecord[]>('/users'),
      ]);
      setInterviews(ints);
      setApplications(appsRes.data);
      setUsers(usersRes);
      if (appsRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, applicationId: appsRes.data[0].id }));
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [statusFilter, search]);

  const handleSchedule = async (e: React.FormEvent) => {
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
      fetchInterviews();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to schedule interview.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="interviews-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Recruitment & Evaluation</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>Interviews & Scheduling</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Schedule interviews, manage attendees, and capture evaluation scorecards</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setIsScheduleModalOpen(true)}
          style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
        >
          + Schedule Interview
        </button>
      </div>

      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Scheduled Interviews</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#2563eb' }}>
            {interviews.filter(i => i.status === 'Scheduled').length}
          </strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Completed This Month</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#16a34a' }}>
            {interviews.filter(i => i.status === 'Completed').length}
          </strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Pending Scorecards</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#7c3aed' }}>
            {interviews.filter(i => (i.scorecards?.length ?? 0) === 0).length}
          </strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Cancelled / Rescheduled</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: 'var(--muted)' }}>
            {interviews.filter(i => i.status === 'Cancelled' || i.status === 'Rescheduled').length}
          </strong>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div className="toolbar" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by title, interview code, or candidate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rescheduled">Rescheduled</option>
          </select>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
            {error} <button onClick={fetchInterviews} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Loading interviews...</div>
        ) : interviews.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No interviews found matching filters.</div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: '10px' }}>Code</th>
                <th style={{ padding: '10px' }}>Title & Type</th>
                <th style={{ padding: '10px' }}>Candidate & Position</th>
                <th style={{ padding: '10px' }}>Schedule Time</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((i) => (
                <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{i.interviewCode}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{i.title}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Type: {i.interviewType}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div><strong>{i.candidateName || 'Candidate'}</strong></div>
                    <small style={{ color: 'var(--muted)' }}>{i.positionTitle || 'Position'}</small>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div>{new Date(i.scheduledStart).toLocaleString()}</div>
                    <small style={{ color: 'var(--muted)' }}>Timezone: {i.timezone}</small>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '12px', background: i.status === 'Completed' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: i.status === 'Completed' ? '#16a34a' : '#2563eb', fontWeight: 600, fontSize: '11px' }}>
                      {i.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <Link to={`/interviews/${i.id}`} style={{ padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', textDecoration: 'none' }}>
                      Scorecard & View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Schedule New Interview">
        <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{formError}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Select Application / Candidate *</label>
            <select
              value={formData.applicationId}
              onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.applicationCode} — {app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : 'Candidate'} ({app.positionTitle || 'Position'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Interview Title *</label>
            <input
              required
              type="text"
              placeholder="e.g. Technical System Architecture Interview"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Interview Type</label>
              <select
                value={formData.interviewType}
                onChange={(e) => setFormData({ ...formData, interviewType: e.target.value as Interview['interviewType'] })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="Screening">Screening</option>
                <option value="Technical">Technical</option>
                <option value="Behavioral">Behavioral</option>
                <option value="Managerial">Managerial</option>
                <option value="Executive">Executive</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Location / Meeting URL</label>
              <input
                type="text"
                placeholder="https://meet.google.com/xyz"
                value={formData.locationUrl}
                onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Scheduled Start Time *</label>
              <input
                required
                type="datetime-local"
                value={formData.scheduledStart}
                onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Scheduled End Time *</label>
              <input
                required
                type="datetime-local"
                value={formData.scheduledEnd}
                onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Select Interviewer Attendees</label>
            <select
              multiple
              value={formData.attendeeUserIds}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions, (option) => option.value);
                setFormData({ ...formData, attendeeUserIds: options });
              }}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', height: '90px' }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
              ))}
            </select>
            <small style={{ fontSize: '10px', color: 'var(--muted)' }}>Hold Ctrl/Cmd to select multiple interviewers</small>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}
            >
              {submitting ? 'Scheduling...' : 'Schedule Interview'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
