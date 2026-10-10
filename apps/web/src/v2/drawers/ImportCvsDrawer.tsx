import { useRef, useState } from 'react';
import { CircleCheck, CircleX, FileText, Link2, TriangleAlert, Upload } from 'lucide-react';
import { ButtonV2, DrawerV2, StatusChip } from '../../components/v2';
import { cvFileProblem, duplicateCheck, importRow, parseCv, splitName, type DuplicateCheckResult, type ExtractedCv, type ImportDecision } from '../api/cvImport';
import { errorMessage, jobTitle, type JobDetail } from '../api/jobs';

type RowStatus = 'parsing' | 'ready' | 'unreadable' | 'invalid' | 'importing' | 'done' | 'failed';
interface Row { key: string; file: File; status: RowStatus; cv?: ExtractedCv; dup?: DuplicateCheckResult | null; decision?: ImportDecision; problem?: string }

const MATCH_LABEL = { email: 'same email', phone: 'same phone' } as const;

/** E11 Import CVs: upload → parse → duplicate check (B6) → link existing person or create → add to this job (Applied). */
export function ImportCvsDrawer({ job, onClose, onDone }: { job: JobDetail; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setSummary(null);
    const fresh: Row[] = [...files].map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, status: 'parsing' as RowStatus }));
    setRows((rs) => [...rs, ...fresh]);
    for (const row of fresh) {
      const problem = cvFileProblem(row.file);
      if (problem) { patch(row.key, { status: 'invalid', problem }); continue; }
      void (async () => {
        try {
          const cv = await parseCv(row.file);
          const named = Boolean(cv.firstName || cv.lastName || cv.email || cv.phone);
          if (!named && !cv.rawText?.trim()) { patch(row.key, { status: 'unreadable', problem: 'No readable text. Re-scan it or add it as a single CV.' }); return; }
          let dup: DuplicateCheckResult | null = null;
          if (cv.email || cv.phone) dup = await duplicateCheck({ ...(cv.email ? { email: cv.email } : {}), ...(cv.phone ? { phone: cv.phone } : {}) });
          const decision: ImportDecision = dup?.matches[0] ? { kind: 'link', candidateId: dup.matches[0].candidateId } : { kind: 'create' };
          patch(row.key, { status: 'ready', cv, dup, decision });
        } catch (e) {
          patch(row.key, { status: 'unreadable', problem: errorMessage(e, 'The CV could not be read.') });
        }
      })();
    }
  };

  const ready = rows.filter((r) => r.status === 'ready');
  const parsing = rows.some((r) => r.status === 'parsing');
  const run = async () => {
    setBusy(true);
    let ok = 0; let linked = 0; let failed = 0;
    for (const r of ready) {
      patch(r.key, { status: 'importing' });
      try {
        await importRow(job.id, r.file, r.cv ?? {}, r.decision ?? { kind: 'create' });
        ok += 1; if (r.decision?.kind === 'link') linked += 1;
        patch(r.key, { status: 'done' });
      } catch (e) {
        failed += 1;
        patch(r.key, { status: 'failed', problem: errorMessage(e, 'Import failed.') });
      }
    }
    setBusy(false);
    setSummary(`${ok} added to Applied${linked ? ` (${linked} linked to an existing person)` : ''}${failed ? ` · ${failed} failed` : ''}.`);
    if (ok && !failed) onDone();
  };

  return (
    <DrawerV2 open onClose={onClose} kicker={`Import CVs · ${jobTitle(job)}`} title="Add candidates to Applied"
      confirmClose={() => busy ? false : ready.length === 0 || window.confirm('Discard these CVs?')}
      primaryAction={<ButtonV2 icon={<Upload />} loading={busy} disabled={!ready.length || parsing} onClick={() => void run()}>{`Import ${ready.length} to Applied`}</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <div className="rf2-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
          <Upload aria-hidden="true" />
          <label htmlFor="cv-files" className="rf2-drop__label">Drop CVs or <span className="rf2-link">select files</span></label>
          <input id="cv-files" ref={input} className="rf2-sr-only" type="file" multiple accept=".pdf,.doc,.docx" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <p className="rf2-jtable__sub">Select one or several PDF or Word files, up to 10 MB each. Each CV is checked against the bank by email and phone.</p>
        </div>
        {rows.length ? (
          <ul className="rf2-imports" aria-label="CVs">
            {rows.map((r) => <ImportRow key={r.key} row={r} onDecide={(d) => patch(r.key, { decision: d })} />)}
          </ul>
        ) : null}
        {summary ? <p className="rf2-inline-note" role="status">{summary}</p> : null}
      </div>
    </DrawerV2>
  );
}

function ImportRow({ row, onDecide }: { row: Row; onDecide: (d: ImportDecision) => void }) {
  const chip = {
    parsing: <StatusChip tone="neutral" label="Reading…" />,
    ready: row.dup?.isDuplicate ? <StatusChip tone="warning" label="Duplicate" /> : <StatusChip tone="success" label="Parsed" />,
    unreadable: <StatusChip tone="danger" label="Unreadable" />,
    invalid: <StatusChip tone="danger" label="Not accepted" />,
    importing: <StatusChip tone="neutral" label="Importing…" />,
    done: <StatusChip tone="success" label={row.decision?.kind === 'link' ? 'Linked' : 'Added'} />,
    failed: <StatusChip tone="danger" label="Failed" />,
  }[row.status];
  const name = row.cv ? splitName(row.cv, row.file.name) : null;
  const group = `dup-${row.key}`;
  return (
    <li className="rf2-imports__row" aria-busy={row.status === 'parsing' || row.status === 'importing' || undefined}>
      <div className="rf2-row-between"><span className="rf2-imports__file"><FileText aria-hidden="true" /> {row.file.name}</span>{chip}</div>
      {row.problem ? <p className="rf2-imports__problem" role={row.status === 'failed' ? 'alert' : undefined}><CircleX aria-hidden="true" /> {row.problem}</p> : null}
      {row.status === 'ready' && row.cv ? (
        <dl className="rf2-imports__parsed">
          <div><dt>Name</dt><dd>{name ? `${name.firstName} ${name.lastName}` : '—'}</dd></div>
          {row.cv.title ? <div><dt>Current title</dt><dd>{row.cv.title}{row.cv.currentCompany ? `, ${row.cv.currentCompany}` : ''}</dd></div> : null}
          <div><dt>Email</dt><dd>{row.cv.email ?? 'Not found'}</dd></div>
          <div><dt>Phone</dt><dd>{row.cv.phone ?? 'Not found'}</dd></div>
          {typeof row.cv.experienceYears === 'number' ? <div><dt>Experience</dt><dd>{row.cv.experienceYears} years</dd></div> : null}
        </dl>
      ) : null}
      {row.status === 'ready' && !row.cv?.email && !row.cv?.phone ? (
        <p className="rf2-inline-note" data-tone="warning"><TriangleAlert aria-hidden="true" /> No email or phone in this CV, so it can’t be checked for duplicates. It will be added as a new person.</p>
      ) : null}
      {row.status === 'ready' && row.dup?.isDuplicate ? (
        <fieldset className="rf2-dup">
          <legend className="rf2-dup__legend"><TriangleAlert aria-hidden="true" /> Already in the bank. It will be linked to the existing person, not copied (a second person with the same email or phone is not allowed).</legend>
          {row.dup.matches.map((m) => (
            <label key={m.candidateId} className="rf2-dup__opt">
              <input type="radio" name={group} checked={row.decision?.kind === 'link' && row.decision.candidateId === m.candidateId} onChange={() => onDecide({ kind: 'link', candidateId: m.candidateId })} />
              <span><Link2 aria-hidden="true" /> Link to <strong>{m.name}</strong> ({m.candidateCode}{m.status !== 'Active' ? `, ${m.status}` : ''})
                <span className="rf2-dup__why">Evidence: {m.matchedBy.map((k) => `${MATCH_LABEL[k]} (${k === 'email' ? row.dup?.normalized.email : row.dup?.normalized.phone})`).join(' and ')}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {row.status === 'done' ? <p className="rf2-jtable__sub"><CircleCheck aria-hidden="true" /> Added to Applied.</p> : null}
    </li>
  );
}
