import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Interview, InterviewScorecardItem } from '@recruitflow/contracts';

export function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(4);
  const [recommendation, setRecommendation] = useState<InterviewScorecardItem['recommendation']>('Hire');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scorecardError, setScorecardError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getApi<Interview>(`/interviews/${id}`);
      setInterview(res);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load interview details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSubmitScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setScorecardError(null);

    try {
      await postApi(`/interviews/${id}/scorecard`, {
        overallRating: rating,
        recommendation,
        strengths,
        concerns,
        notes,
      });
      loadData();
    } catch (err: unknown) {
      setScorecardError((err as Error).message || 'Failed to submit scorecard.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading interview profile...</div>;
  }

  if (error || !interview) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
        {error || 'Interview not found.'}
        <div><Link to="/interviews" style={{ textDecoration: 'underline', marginTop: '8px', display: 'inline-block' }}>Back to Interviews</Link></div>
      </div>
    );
  }

  return (
    <div className="interview-detail-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Interviews / {interview.interviewCode}</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>{interview.title}</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Candidate: <strong>{interview.candidateName || 'N/A'}</strong> — Position: {interview.positionTitle || 'N/A'}
          </p>
        </div>
        <div>
          <span style={{ padding: '6px 14px', borderRadius: '16px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>
            Status: {interview.status}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Interview Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Interview Type</span>
                <strong>{interview.interviewType}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Scheduled Start</span>
                <strong>{new Date(interview.scheduledStart).toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Scheduled End</span>
                <strong>{new Date(interview.scheduledEnd).toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Timezone</span>
                <span>{interview.timezone}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Location / Video URL</span>
                {interview.locationUrl ? (
                  <a href={interview.locationUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                    {interview.locationUrl}
                  </a>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>Not specified</span>
                )}
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Assigned Interviewers & Attendees</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              {interview.attendees?.map((att) => (
                <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--background)', borderRadius: '6px' }}>
                  <div>
                    <strong>{att.userName || att.userId}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>({att.role})</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 500 }}>{att.response}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Submitted Scorecards ({interview.scorecards?.length ?? 0})</h3>
            {interview.scorecards?.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No scorecards submitted yet. Complete the form on the right to submit your evaluation.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {interview.scorecards?.map((sc) => (
                  <div key={sc.id} style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong>{sc.interviewerName || 'Interviewer'}</strong>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                        {sc.recommendation} ({sc.overallRating}/5)
                      </span>
                    </div>
                    {sc.strengths && <div><strong style={{ fontSize: '11px', color: 'var(--muted)' }}>Strengths:</strong> <p style={{ margin: '2px 0 6px 0' }}>{sc.strengths}</p></div>}
                    {sc.concerns && <div><strong style={{ fontSize: '11px', color: 'var(--muted)' }}>Concerns:</strong> <p style={{ margin: '2px 0 6px 0' }}>{sc.concerns}</p></div>}
                    {sc.notes && <div><strong style={{ fontSize: '11px', color: 'var(--muted)' }}>Notes:</strong> <p style={{ margin: '2px 0 0 0' }}>{sc.notes}</p></div>}
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--muted)' }}>
                      Submitted on {new Date(sc.submittedAt).toLocaleString()} {sc.isLocked && '🔒 (Locked)'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Submit Evaluation Scorecard</h3>
          <form onSubmit={handleSubmitScorecard} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {scorecardError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{scorecardError}</div>}
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Overall Rating (1 to 5 Stars)</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value={5}>5 — Exceptional / Exceeds All Expectations</option>
                <option value={4}>4 — Strong Candidate / Meets Expectations</option>
                <option value={3}>3 — Moderate / Partial Match</option>
                <option value={2}>2 — Below Expectations</option>
                <option value={1}>1 — Unsuitable</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Hiring Recommendation *</label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value as InterviewScorecardItem['recommendation'])}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="Strong Hire">Strong Hire</option>
                <option value="Hire">Hire</option>
                <option value="Neutral">Neutral</option>
                <option value="No Hire">No Hire</option>
                <option value="Strong No Hire">Strong No Hire</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Candidate Strengths</label>
              <textarea
                rows={2}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="Key technical skills, communication, problem solving..."
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              ></textarea>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Concerns / Red Flags</label>
              <textarea
                rows={2}
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="Areas requiring further probe or domain gaps..."
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              ></textarea>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Additional Evaluation Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="General interview notes..."
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, marginTop: '8px' }}
            >
              {submitting ? 'Submitting & Locking...' : 'Submit & Lock Scorecard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
