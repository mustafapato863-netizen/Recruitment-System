import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DragDropProvider, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/react';
import { ArrowRight, CircleX, Clock, MoveRight, Pause, Play, RotateCw, Sparkles, Upload } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { patchApi } from '../../api/client';
import {
  ACCEPTING_JOB_STATUSES, BOARD_LABEL, BOARD_STAGES, MOVE_GATE_HINT, isRedactedJob, jobActions, jobErrorFromError, jobOwner, jobTitle, loadClosedFiles, loadJobBoard, moveCheck,
  type BoardApplication, type BoardStage, type JobBoard, type JobDetail,
} from '../api/jobs';
import { GATE_COPY, type GateCode } from '../api/gates';
import { JobStatusDrawer } from '../drawers/JobStatusDrawer';
import { ImportCvsDrawer } from '../drawers/ImportCvsDrawer';
import { SuggestDrawer } from '../drawers/SuggestDrawer';
import { STATUS_LABEL, STATUS_TONE, formatDay } from './OpenJobsV2';
import './jobs.css';

type State = { kind: 'loading' } | { kind: 'ready'; board: JobBoard } | { kind: 'error'; message: string } | { kind: 'forbidden'; message?: string } | { kind: 'missing' };
type Toast = { tone: 'danger' | 'success'; title: string; body?: string } | null;

export function cardName(a: BoardApplication): string {
  const n = `${a.candidate?.firstName ?? ''} ${a.candidate?.lastName ?? ''}`.trim();
  return n || a.applicationCode;
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** E09 Job pipeline board + E11/E12 drawers (?drawer=import|status). */
export function JobPipelineV2() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const drawer = params.get('drawer');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [moving, setMoving] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [closedOpen, setClosedOpen] = useState(false);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    loadJobBoard(id)
      .then((board) => { if (live) setState({ kind: 'ready', board }); })
      .catch((e: { statusCode?: number; message?: string }) => {
        if (!live) return;
        if (e?.statusCode === 403) setState({ kind: 'forbidden', message: e.message });
        else if (e?.statusCode === 404) setState({ kind: 'missing' });
        else setState({ kind: 'error', message: e?.message || 'Something went wrong.' });
      });
    return () => { live = false; };
  }, [id, attempt]);

  const setDrawer = (d: string | null) => {
    const next = new URLSearchParams(params);
    if (d) next.set('drawer', d); else next.delete('drawer');
    setParams(next, { replace: false });
  };

  const move = async (app: BoardApplication, target: BoardStage) => {
    if (state.kind !== 'ready') return;
    const check = moveCheck(app, target, state.board.job);
    const name = cardName(app);
    if (!check.ok) { setToast({ tone: 'danger', title: `Can't move ${name} to ${BOARD_LABEL[target]}`, body: check.reason }); return; }
    setMoving(app.id);
    setToast(null);
    try {
      await patchApi(`/applications/${encodeURIComponent(app.id)}/stage`, { stage: target, expectedStage: app.stage, expectedVersion: app.version });
      setToast({ tone: 'success', title: `${name} moved to ${BOARD_LABEL[target]}` });
      reload();
    } catch (e) {
      const d = jobErrorFromError(e);
      const gate = d && 'gate' in d && d.gate ? GATE_COPY[d.gate as GateCode] : null;
      const body = gate
        ? `Missing gate: ${gate.gate.toLowerCase()}. ${name.split(' ')[0]} stays in ${BOARD_LABEL[app.stage as BoardStage]}. ${gate.fix}`
        : d?.code === 'STALE_STAGE' ? 'Someone changed this file first. The board was refreshed.' : (d?.message || (e as Error)?.message || 'The move failed.');
      setToast({ tone: 'danger', title: `Can't move ${name} to ${BOARD_LABEL[target]}`, body });
      if (d?.code === 'STALE_STAGE') reload();
    } finally { setMoving(null); }
  };

  if (state.kind === 'loading') return <div className="rf2-jobs"><SkeletonV2 lines={8} label="Loading the pipeline…" /></div>;
  if (state.kind === 'forbidden') return <div className="rf2-jobs"><ForbiddenStateV2 body={state.message || 'Only the job owner and their manager can open this pipeline.'} action={<Link className="rf2-link" to="/vacancies">Back to Open jobs</Link>} /></div>;
  if (state.kind === 'missing') return <div className="rf2-jobs"><EmptyStateV2 title="Job not found" body="It may have been removed from your scope." action={<Link className="rf2-link" to="/vacancies">Back to Open jobs</Link>} /></div>;
  if (state.kind === 'error') return <div className="rf2-jobs" role="alert"><EmptyStateV2 title="Could not load this pipeline" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={reload}>Try again</ButtonV2>} /></div>;

  const { job, apps, closed } = state.board;
  if (isRedactedJob(job)) {
    return (
      <div className="rf2-jobs">
        <nav aria-label="Breadcrumb" className="rf2-crumbs"><Link to="/vacancies">Open jobs</Link> › <span aria-current="page">{job.title}</span></nav>
        <ForbiddenStateV2 title={`${job.title} is owned by another recruiter`} body={`${job.site?.name ?? 'Site not shown'} · ${job.seats.filled} of ${job.seats.target} seats. Files on this job are visible only to its owner and the owner’s manager.`} action={<Link className="rf2-link" to="/vacancies">Back to Open jobs</Link>} />
      </div>
    );
  }
  const title = jobTitle(job);
  const owner = jobOwner(job);
  const accepting = ACCEPTING_JOB_STATUSES.includes(job.status);
  const actions = jobActions(job.status);
  const seats = { filled: job.targetChip?.filled ?? job.joinedHeadcount, target: job.targetChip?.target ?? job.approvedHeadcount };
  const due = job.targetChip?.dueDate ?? null;
  const overdue = due ? due < new Date().toISOString().slice(0, 10) : false;

  return (
    <div className="rf2-jobs">
      <nav aria-label="Breadcrumb" className="rf2-crumbs"><Link to="/vacancies">Open jobs</Link> › <span aria-current="page">{title}</span></nav>
      <section className="rf2-panel rf2-jobhead" aria-label="Job summary">
        <div className="rf2-jobhead__top">
          <div>
            <h1 className="rf2-jobhead__title">{title} <StatusChip tone={STATUS_TONE[job.status]} label={STATUS_LABEL[job.status]} /></h1>
            <p className="rf2-jtable__sub">{[job.department, job.branch?.name, owner ? `Owner: ${owner.name}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="rf2-jobhead__actions">
            {actions.includes('reopen') ? <ButtonV2 kind="tertiary" icon={<Play />} onClick={() => setDrawer('status')}>Reopen job</ButtonV2>
              : actions.length ? <ButtonV2 kind="tertiary" icon={<Pause />} onClick={() => setDrawer('status')}>Hold job</ButtonV2> : null}
            <ButtonV2 kind="secondary" icon={<Sparkles />} onClick={() => setDrawer('suggest')}>Suggest from bank</ButtonV2>
            <ButtonV2 icon={<Upload />} onClick={() => setDrawer('import')} disabled={!accepting} aria-describedby={accepting ? undefined : 'import-why'}>Import CVs</ButtonV2>
            {!accepting ? <span id="import-why" className="rf2-sr-only">{job.status === 'On Hold' ? 'A held job takes no new applications.' : `A ${STATUS_LABEL[job.status].toLowerCase()} job takes no new applications.`}</span> : null}
          </div>
        </div>
        <dl className="rf2-jobhead__stats">
          <div><dt>Seats</dt><dd className="rf2-num" data-tone={seats.filled > 0 ? 'success' : undefined}>{seats.filled} of {seats.target} filled</dd></div>
          <div><dt>Due</dt><dd className="rf2-num" data-tone={overdue ? 'warning' : undefined}>{formatDay(due)}</dd></div>
          <div><dt>Active files</dt><dd className="rf2-num">{apps.length}</dd></div>
        </dl>
        {job.status === 'On Hold' ? <p className="rf2-jobhead__note"><Clock aria-hidden="true" /> On hold: takes no new applications and is off My Work. Files stay in their stages.</p> : null}
      </section>

      <DragDropProvider onDragEnd={(event: DragEndEvent) => {
        if (event.canceled) return;
        const sourceId = event.operation.source?.id;
        const target = event.operation.target?.data?.stage as BoardStage | undefined;
        const app = apps.find((a) => a.id === sourceId);
        if (app && target && target !== app.stage) void move(app, target);
      }}>
        <div className="rf2-board" aria-label={`${title} pipeline`} role="region">
          {BOARD_STAGES.map((stage) => (
            <Column key={stage} stage={stage} apps={apps.filter((a) => a.stage === stage)} job={job} moving={moving} onMove={move} />
          ))}
        </div>
      </DragDropProvider>

      <div className="rf2-board__foot">
        <button type="button" className="rf2-link rf2-closed-link" aria-expanded={closedOpen} aria-controls="closed-files" onClick={() => setClosedOpen((v) => !v)}>
          <ArrowRight aria-hidden="true" /> Closed for this job · {closed.rejected} rejected, {closed.joined} joined{closed.withdrawn ? `, ${closed.withdrawn} withdrawn` : ''}
        </button>
        {toast ? (
          <div className="rf2-toast" data-tone={toast.tone} role={toast.tone === 'danger' ? 'alert' : 'status'}>
            {toast.tone === 'danger' ? <CircleX aria-hidden="true" /> : null}
            <div><p className="rf2-toast__title">{toast.title}</p>{toast.body ? <p>{toast.body}</p> : null}</div>
            <button type="button" className="rf2-link" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
          </div>
        ) : null}
      </div>
      {closedOpen ? <ClosedFiles id="closed-files" vacancyId={job.id} /> : null}

      {drawer === 'status' ? <JobStatusDrawer job={job} onClose={() => setDrawer(null)} onDone={() => { setDrawer(null); reload(); }} /> : null}
      {drawer === 'suggest' ? <SuggestDrawer job={job} accepting={accepting} onClose={() => setDrawer(null)} onAdded={reload} /> : null}
      {drawer === 'import' ? <ImportCvsDrawer job={job} onClose={() => setDrawer(null)} onDone={() => { setDrawer(null); reload(); }} /> : null}
    </div>
  );
}

function Column({ stage, apps, job, moving, onMove }: { stage: BoardStage; apps: BoardApplication[]; job: JobDetail; moving: string | null; onMove: (a: BoardApplication, s: BoardStage) => void }) {
  const { ref, isDropTarget } = useDroppable({
    id: `col-${stage}`,
    data: { stage },
    accept: (source) => {
      const app = source.data?.app as BoardApplication | undefined;
      return Boolean(app && moveCheck(app, stage, job).ok);
    },
  });
  const headId = `col-${stage}-h`;
  return (
    <section ref={ref} className="rf2-col" data-drop={isDropTarget || undefined} aria-labelledby={headId}>
      <h2 id={headId} className="rf2-col__head"><span>{BOARD_LABEL[stage]}</span><span className="rf2-col__count" aria-label={`${apps.length} files`}>{apps.length}</span></h2>
      {apps.length === 0 ? <p className="rf2-col__empty">No files in {BOARD_LABEL[stage]}</p> : (
        <ul className="rf2-col__list">{apps.map((a) => <li key={a.id}><Card app={a} job={job} moving={moving === a.id} onMove={onMove} /></li>)}</ul>
      )}
    </section>
  );
}

function Card({ app, job, moving, onMove }: { app: BoardApplication; job: JobDetail; moving: boolean; onMove: (a: BoardApplication, s: BoardStage) => void }) {
  const name = cardName(app);
  const targets = BOARD_STAGES.filter((s) => s !== app.stage).map((s) => ({ stage: s, ...moveCheck(app, s, job) }));
  const canDrag = targets.some((t) => t.ok) && !moving;
  const { ref, handleRef, isDragging } = useDraggable({ id: app.id, data: { app }, disabled: !canDrag });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node) && e.target !== btnRef.current) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);
  const sub = app.lastActivityLabel ? `${app.lastActivityLabel}${app.lastActivityAt ? ` · ${formatDay(app.lastActivityAt)}` : ''}` : `Applied ${formatDay(app.appliedAt)}${app.source ? ` · ${app.source}` : ''}`;
  return (
    <article ref={ref} className="rf2-kcard" data-dragging={isDragging || undefined} aria-busy={moving || undefined} aria-label={`${name}, ${BOARD_LABEL[app.stage as BoardStage]}`}>
      <div className="rf2-kcard__top">
        <span className="rf2-kcard__avatar" aria-hidden="true" ref={handleRef}>{initials(name)}</span>
        <Link className="rf2-kcard__name" to={`/applications/${encodeURIComponent(app.id)}`}>{name}</Link>
      </div>
      <p className="rf2-kcard__sub">{sub}</p>
      {app.nextFollowUpAt ? <p className="rf2-kcard__chip" data-tone={app.nextFollowUpAt < new Date().toISOString() ? 'warning' : 'info'}><Clock aria-hidden="true" /> Follow-up due {formatDay(app.nextFollowUpAt)}</p> : null}
      <div className="rf2-kcard__menu">
        <button ref={btnRef} type="button" className="rf2-link" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} disabled={moving}>
          <MoveRight aria-hidden="true" /> Move to…<span className="rf2-sr-only"> ({name})</span>
        </button>
        {menu ? (
          <div ref={menuRef} role="menu" aria-label={`Move ${name} to`} className="rf2-menu"
            onKeyDown={(e) => {
              const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
              const i = items.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === 'Escape') { setMenu(false); btnRef.current?.focus(); }
              if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
              if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
            }}>
            {targets.map((t) => (
              <button key={t.stage} type="button" role="menuitem" aria-disabled={!t.ok || undefined} className="rf2-menu__item"
                onClick={() => { if (!t.ok) return; setMenu(false); btnRef.current?.focus(); onMove(app, t.stage); }}>
                <span>{BOARD_LABEL[t.stage]}</span>
                <span className="rf2-menu__hint">{t.ok ? MOVE_GATE_HINT[t.stage] ?? '' : t.reason}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ClosedFiles({ id, vacancyId }: { id: string; vacancyId: string }) {
  const [rows, setRows] = useState<BoardApplication[] | null>(null);
  useEffect(() => { void loadClosedFiles(vacancyId).then(setRows).catch(() => setRows([])); }, [vacancyId]);
  return (
    <section id={id} className="rf2-panel" aria-label="Closed files">
      {rows === null ? <SkeletonV2 lines={2} label="Loading closed files…" /> : rows.length === 0 ? <p className="rf2-jtable__sub">No closed files yet.</p> : (
        <ul className="rf2-closed">{rows.map((a) => <li key={a.id}><Link to={`/applications/${encodeURIComponent(a.id)}`}>{cardName(a)}</Link> <StatusChip tone={a.stage === 'Joined' ? 'success' : 'neutral'} label={a.stage} /></li>)}</ul>
      )}
    </section>
  );
}
