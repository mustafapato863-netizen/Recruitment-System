import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCw, ShieldCheck, XCircle } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { getApi, postApi } from '../../api/client';
import './jobs.css';
import './team.css';

interface ApprovalRow {
  id: string;
  applicationId?: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  status: string;
  /** Meeting notes 2026-11-25 (item 4): expected joining date shown to approvers. */
  plannedJoiningDate?: string | null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; records: ApprovalRow[] }
  | { kind: 'error'; reason: string };
type Decision = { record: ApprovalRow; action: 'Approve' | 'Reject' };

/**
 * Authorization is enforced by the final-hiring API. This UI must never
 * optimistically mark somebody joined: approval authorizes a later, separate
 * actual joining step after the required checks.
 */
export function FinalApprovalInboxV2() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<Decision | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    getApi<ApprovalRow[]>('/hiring/final-approvals')
      .then((records) => {
        if (!active) return;
        if (!Array.isArray(records)) throw new Error('The final approval response was invalid.');
        setState({ kind: 'ready', records });
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: 'error', reason: error instanceof Error ? error.message : 'Could not load final approvals.' });
      });
    return () => { active = false; };
  }, [attempt]);

  const choose = (record: ApprovalRow, action: 'Approve' | 'Reject') => {
    setChoice({ record, action });
    setComment('');
    setDecisionError(null);
  };
  const close = () => {
    if (!saving) {
      setChoice(null);
      setDecisionError(null);
      setComment('');
    }
  };
  const saveDecision = async () => {
    if (!choice || saving) return;
    const cleaned = comment.trim();
    if (choice.action === 'Reject' && !cleaned) {
      setDecisionError('A rejection reason is required.');
      return;
    }
    setSaving(true);
    setDecisionError(null);
    try {
      await postApi(`/hiring/${encodeURIComponent(choice.record.id)}/final-approval`, {
        decision: choice.action,
        comment: cleaned || 'Final hiring decision authorized from the approval inbox.',
      });
      setChoice(null);
      setComment('');
      setAttempt((n) => n + 1);
    } catch (error: unknown) {
      setDecisionError(error instanceof Error ? error.message : 'The decision could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const items = state.kind === 'ready' ? state.records : [];

  return (
    <main className="rf2-jobs rf2-team">
      <header className="rf2-team__bar">
        <div>
          <h1 className="rf2-team__title">Final hiring approvals</h1>
          <p className="rf2-team__intro">Review each case and confirm compliance before authorizing hiring. Final approval never records actual joining.</p>
        </div>
        <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Refresh</ButtonV2>
      </header>
      {state.kind === 'ready' ? (
        <div className="rf2-team__toolbar" role="status">
          <StatusChip tone={items.length ? 'warning' : 'success'} label={`${items.length} pending`} />
        </div>
      ) : null}
      <section className="rf2-panel">
        {state.kind === 'loading' ? <SkeletonV2 lines={5} label="Loading final approvals…" /> : null}
        {state.kind === 'error' ? (
          <div role="alert"><EmptyStateV2 title="Could not load final approvals" body={state.reason}
            action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>
        ) : null}
        {state.kind === 'ready' && items.length === 0 ? (
          <EmptyStateV2 title="Final approval inbox is clear" body="No hiring cases are currently awaiting your authorization." />
        ) : null}
        {state.kind === 'ready' && items.length > 0 ? (
          <div className="rf2-jscroll">
            <table className="rf2-jtable" aria-label="Pending final hiring approvals">
              <thead><tr><th scope="col">Candidate</th><th scope="col">Position</th><th scope="col">Site</th><th scope="col">Expected joining</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
              <tbody>{items.map((row) => (
                <tr key={row.id}>
                  <td><strong className="rf2-jtable__name">{row.candidateName}</strong></td>
                  <td>{row.positionTitle}</td>
                  <td>{row.branchName}</td>
                  <td>{row.plannedJoiningDate ? new Date(row.plannedJoiningDate).toLocaleDateString('en-GB') : 'Not set'}</td>
                  <td><StatusChip tone="warning" label={row.status} /></td>
                  <td>
                    <div className="rf2-row-between" style={{ gap: '0.5rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={row.applicationId ? `/applications/${encodeURIComponent(row.applicationId)}` : `/hires/${encodeURIComponent(row.id)}`}>Review case</Link>
                      <ButtonV2 kind="secondary" size="sm" icon={<XCircle />} onClick={() => choose(row, 'Reject')}>Reject</ButtonV2>
                      <ButtonV2 size="sm" icon={<CheckCircle2 />} onClick={() => choose(row, 'Approve')}>Authorize hire</ButtonV2>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </section>

      <DrawerV2
        open={choice !== null}
        title={choice?.action === 'Reject' ? 'Reject final hiring approval' : 'Authorize final hiring'}
        kicker="Final approval decision"
        subtitle={choice ? `${choice.record.candidateName} · ${choice.record.positionTitle} · ${choice.record.branchName}` : ''}
        onClose={close}
        primaryAction={<ButtonV2 icon={<ShieldCheck />} loading={saving} disabled={saving} onClick={() => void saveDecision()}>
          {choice?.action === 'Reject' ? 'Confirm rejection' : 'Confirm authorization'}
        </ButtonV2>}
        secondaryAction={<ButtonV2 kind="secondary" disabled={saving} onClick={close}>Cancel</ButtonV2>}
      >
        <p>Check the candidate file and all required compliance evidence before deciding. This decision is recorded with the hiring case history.</p>
        <label htmlFor="final-approval-reason" className="rf2-file__label">
          {choice?.action === 'Reject' ? 'Reason (required)' : 'Decision note (optional)'}
        </label>
        <textarea id="final-approval-reason" className="rf2-field__input" rows={4}
          value={comment} onChange={(event) => setComment(event.target.value)}
          aria-invalid={Boolean(decisionError)} placeholder="Record the evidence supporting this decision." />
        {decisionError ? <p role="alert" className="rf2-form-error">{decisionError}</p> : null}
      </DrawerV2>
    </main>
  );
}
