import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { getApi, postApi } from '../api/client';
import type { Interview, Application, UserRecord } from '@recruitflow/contracts';
import type { MetricStyle } from '../utils/styles';

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
      const [ints, appsRes, usersRes] = await Promise.all([
        getApi<Interview[]>(`/interviews`),
        getApi<{ data: Application[] }>('/applications'),
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
  }, []);

  const filtered = useMemo(() => interviews.filter((i) => {
    const searchable = `${i.interviewCode} ${i.title} ${i.candidateName} ${i.positionTitle}`.toLowerCase();
    return (!search || searchable.includes(search.toLowerCase())) && (!statusFilter || i.status === statusFilter);
  }), [interviews, search, statusFilter]);

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

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'Scheduled': return 'badge purple';
      case 'Completed': return 'badge green';
      case 'Cancelled': return 'badge red';
      default: return 'badge blue';
    }
  };

  return (
    <>
      <div className="page">
        <div className="head">
          <div>
            <div className="eyebrow">RecruitFlow Workspace</div>
            <h1>Interview Management</h1>
            <div className="sub">Schedule, coordinate and track all interview rounds and feedback.</div>
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={() => void fetchInterviews()}>Refresh</button>
            <button className="btn primary" type="button" onClick={() => setIsScheduleModalOpen(true)}>Schedule Interview</button>
          </div>
        </div>

        {error && <div className="alert bad"><div className="aico">!</div><div><b>Error</b><small>{error}</small></div></div>}
        {loading && <div className="alert ok"><div className="aico">...</div><div><b>Loading</b><small>Fetching interviews</small></div></div>}

        <div className="grid c5">
          <div className="card metric" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as MetricStyle}>
            <div className="m-top"><span className="m-label">Today</span><span className="m-ico">▣</span></div>
            <div className="m-value">8</div>
            <div className="m-foot">2 completed</div>
          </div>
          <div className="card metric" style={{ '--mc': '#2563eb', '--ms': '#eff6ff' } as MetricStyle}>
            <div className="m-top"><span className="m-label">This Week</span><span className="m-ico">▦</span></div>
            <div className="m-value">{interviews.length}</div>
            <div className="m-foot">Across 14 vacancies</div>
          </div>
          <div className="card metric" style={{ '--mc': '#dc2626', '--ms': '#fff1f2' } as MetricStyle}>
            <div className="m-top"><span className="m-label">Feedback Pending</span><span className="m-ico">!</span></div>
            <div className="m-value">{interviews.filter(i => !i.scorecards?.length).length}</div>
            <div className="m-foot">4 overdue</div>
          </div>
          <div className="card metric" style={{ '--mc': '#d97706', '--ms': '#fffbeb' } as MetricStyle}>
            <div className="m-top"><span className="m-label">Rescheduled</span><span className="m-ico">↻</span></div>
            <div className="m-value">{interviews.filter(i => i.status === 'Rescheduled').length}</div>
            <div className="m-foot">This week</div>
          </div>
          <div className="card metric" style={{ '--mc': '#64748b', '--ms': '#f1f5f9' } as MetricStyle}>
            <div className="m-top"><span className="m-label">No Shows</span><span className="m-ico">×</span></div>
            <div className="m-value">{interviews.filter(i => i.status === 'Cancelled').length}</div>
            <div className="m-foot">1 candidate · 1 interviewer</div>
          </div>
        </div>

        <section className="card" style={{ marginTop: '15px' }}>
          <div className="toolbar">
            <div className="searchbox">
              ⌕&nbsp; <input
                placeholder="Search records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 'inherit', color: 'inherit', width: '100%' }}
              />
            </div>
            <select
              className="filter active"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none' }}
            >
              <option value="">All Statuses</option>
              {['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <div className="filter">Interview Stage⌄</div>
            <div className="filter">Interviewer⌄</div>
            <div className="filter">Vacancy⌄</div>
            <div className="filter">More Filters</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Vacancy</th>
                <th>Stage</th>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Interviewers</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td className="cell">{i.candidateName || 'Unknown'}</td>
                  <td>{i.positionTitle || 'Position'}</td>
                  <td>{i.title}</td>
                  <td>{new Date(i.scheduledStart).toLocaleString()}</td>
                  <td>{i.interviewType}</td>
                  <td>{i.attendees?.length ?? 0} Interviewers</td>
                  <td><span className={getStatusBadgeClass(i.status)}>{i.status}</span></td>
                  <td>
                    <Link className="btn sm" to={`/interviews/${i.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                    <div className="empty">
                      <div className="eico">▣</div>
                      <h3>No matching interviews</h3>
                      <p>Adjust the filters or schedule a new interview.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Schedule New Interview">
        <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && <div className="alert bad"><div className="aico">!</div><div><b>Error</b><small>{formError}</small></div></div>}
          <div className="form-grid">
            <label className="full-field">Select Application / Candidate *
              <select value={formData.applicationId} onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.applicationCode} — {app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : 'Candidate'} ({app.positionTitle || 'Position'})
                  </option>
                ))}
              </select>
            </label>
            <label className="full-field">Interview Title *
              <input required type="text" placeholder="e.g. Technical System Architecture Interview" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </label>
            <label>Interview Type
              <select value={formData.interviewType} onChange={(e) => setFormData({ ...formData, interviewType: e.target.value as Interview['interviewType'] })}>
                <option value="Screening">Screening</option>
                <option value="Technical">Technical</option>
                <option value="Behavioral">Behavioral</option>
                <option value="Managerial">Managerial</option>
                <option value="Executive">Executive</option>
              </select>
            </label>
            <label>Location / Meeting URL
              <input type="text" placeholder="https://meet.google.com/xyz" value={formData.locationUrl} onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })} />
            </label>
            <label>Scheduled Start Time *
              <input required type="datetime-local" value={formData.scheduledStart} onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })} />
            </label>
            <label>Scheduled End Time *
              <input required type="datetime-local" value={formData.scheduledEnd} onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })} />
            </label>
            <label className="full-field">Select Interviewer Attendees
              <select multiple value={formData.attendeeUserIds} onChange={(e) => setFormData({ ...formData, attendeeUserIds: Array.from(e.target.selectedOptions, (o) => o.value) })} style={{ height: '90px' }}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="quiet-button" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>{submitting ? 'Scheduling...' : 'Schedule Interview'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
