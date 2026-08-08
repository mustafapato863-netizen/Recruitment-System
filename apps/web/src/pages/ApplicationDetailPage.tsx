import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type {
  Application,
  ApplicationStage,
  ApplicationStatusHistoryItem,
} from '@recruitflow/contracts';
import { PipelineStepper } from '../components/PipelineStepper';

const ALLOWED_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening', 'Rejected', 'Withdrawn'],
  Screening: ['Interview', 'Rejected', 'Withdrawn'],
  Interview: ['Offer', 'Rejected', 'Withdrawn'],
  Offer: ['Pre-Hire', 'Rejected', 'Withdrawn'],
  'Pre-Hire': ['Joined', 'Rejected', 'Withdrawn'],
  Joined: [],
  Rejected: ['Applied', 'Screening', 'Interview'],
  Withdrawn: ['Applied'],
};

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetStage, setTargetStage] = useState<ApplicationStage>('Screening');
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [app, hist] = await Promise.all([
        getApi<Application>(`/applications/${id}`),
        getApi<ApplicationStatusHistoryItem[]>(`/applications/${id}/history`),
      ]);
      setApplication(app);
      setHistory(hist);
      const allowed = ALLOWED_TRANSITIONS[app.stage as ApplicationStage] || [];
      if (allowed.length > 0) {
        setTargetStage(allowed[0]);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load application detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !application) return;
    setUpdating(true);
    setStageError(null);

    try {
      await patchApi(`/applications/${id}/stage`, {
        stage: targetStage,
        reason,
      });
      setReason('');
      loadData();
    } catch (err: unknown) {
      setStageError((err as Error).message || 'Failed to update application stage.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading application details...</div>;
  }

  if (error || !application) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
        {error || 'Application not found.'}
        <div><Link to="/applications" style={{ textDecoration: 'underline', marginTop: '8px', display: 'inline-block' }}>Back to Applications</Link></div>
      </div>
    );
  }

  const allowedTransitions = ALLOWED_TRANSITIONS[application.stage as ApplicationStage] || [];

  return (
    <div className="application-detail-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Applications / {application.applicationCode}</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>
            {application.candidate ? `${application.candidate.firstName} ${application.candidate.lastName}` : 'Candidate'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Applied for {application.positionTitle || 'Position'} (Vacancy: {application.vacancyCode})</p>
        </div>
        <div>
          <span style={{ padding: '6px 14px', borderRadius: '16px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '13px' }}>
            Stage: {application.stage}
          </span>
        </div>
      </div>

      {/* Visual Funnel Stage Stepper */}
      <PipelineStepper
        currentStage={application.stage}
        isRejectedOrWithdrawn={application.stage === 'Rejected' || application.stage === 'Withdrawn'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Application Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Candidate Name</span>
                <strong>
                  {application.candidate ? (
                    <Link to={`/candidates/${application.candidate.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                      {application.candidate.firstName} {application.candidate.lastName}
                    </Link>
                  ) : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Candidate Email</span>
                <strong>{application.candidate?.email || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Target Vacancy</span>
                <strong>{application.positionTitle} ({application.vacancyCode})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Application Source</span>
                <span>{application.source || 'Direct'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Primary Recruiter</span>
                <strong>{application.primaryRecruiterName || 'Unassigned'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Current Task Owner</span>
                <strong>{application.taskOwnerName || 'Unassigned'}</strong>
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Move Stage (Server State Machine)</h3>
            {allowedTransitions.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
                Application is in terminal stage "{application.stage}". No further stage transitions allowed.
              </div>
            ) : (
              <form onSubmit={handleStageChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stageError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{stageError}</div>}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Select Allowed Transition *</label>
                  <select
                    value={targetStage}
                    onChange={(e) => setTargetStage(e.target.value as ApplicationStage)}
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                  >
                    {allowedTransitions.map((stg) => (
                      <option key={stg} value={stg}>Move to {stg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Transition Reason / Comment</label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for moving candidate stage..."
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                  ></textarea>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={updating}
                    style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}
                  >
                    {updating ? 'Updating...' : `Advance Stage to ${targetStage}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Stage History & Audit Trail</h3>
          <div className="history-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {history.map((item) => (
              <div key={item.id} style={{ borderLeft: '2px solid var(--primary)', paddingLeft: '12px', fontSize: '11px' }}>
                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text)' }}>
                  {item.fromStage ? `${item.fromStage} → ${item.toStage}` : `Initial Stage: ${item.toStage}`}
                </strong>
                <span style={{ color: 'var(--muted)', display: 'block' }}>
                  By {item.changedByName || 'System'} on {new Date(item.createdAt).toLocaleString()}
                </span>
                {item.reason && <p style={{ margin: '4px 0 0 0', color: 'var(--text)', fontStyle: 'italic' }}>"{item.reason}"</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
