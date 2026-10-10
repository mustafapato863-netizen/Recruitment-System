import { useEffect, useState } from 'react';
import { CircleCheck, CircleMinus, Info, Plus, RotateCw, Undo2 } from 'lucide-react';
import { ButtonV2, DrawerV2, InputV2, SelectV2, SkeletonV2, StatusChip } from '../../components/v2';
import {
  CATALOGS, addValue, canSeeBandAmounts, createBand, fetchBands, fetchCatalog, fetchOptions, setValueStatus, updateBand,
  type Band, type CatalogDef, type CatalogValue,
} from './configApi';
import { useAuth } from '../../auth/AuthContext';
import '../pages/jobs.css';
import './admin.css';

const fmt = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('en-GB') : '—');

/** A06 Master data (Admin seat): skills, departments, reason lists and grade bands. Entries are deactivated, never deleted. */
export function MasterDataV2() {
  return (
    <div className="rf2-jobs rf2-admin">
      <div>
        <h1 className="rf2-jobs__title">Master data</h1>
        <p className="rf2-jobs__sub">Lists used across requisitions, jobs and drawers. Entries are deactivated, never deleted.</p>
      </div>
      <div className="rf2-admin__grid">
        {CATALOGS.map((c) => <CatalogCard key={c.category} def={c} />)}
      </div>
      <BandsCard />
    </div>
  );
}

function CatalogCard({ def }: { def: CatalogDef }) {
  const [rows, setRows] = useState<CatalogValue[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let live = true; setError(null);
    fetchCatalog(def.category).then((r) => live && setRows(r)).catch((e: { message?: string }) => live && setError(e?.message || 'Could not load.'));
    return () => { live = false; };
  }, [def.category, attempt]);
  const add = async () => {
    const n = name.trim();
    if (!n) return setMsg({ tone: 'error', text: 'Enter a name.' });
    if (rows?.some((r) => r.name.toLowerCase() === n.toLowerCase())) return setMsg({ tone: 'error', text: `“${n}” is already on the list${rows.find((r) => r.name.toLowerCase() === n.toLowerCase())?.status !== 'Active' ? ' (inactive — reactivate it)' : ''}.` });
    setBusy('add');
    try { await addValue(def.category, n); setName(''); setAdding(false); setMsg({ tone: 'success', text: `“${n}” added.` }); setAttempt((x) => x + 1); }
    catch (e) { setMsg({ tone: 'error', text: (e as { message?: string })?.message || 'Could not add.' }); } finally { setBusy(null); }
  };
  const flip = async (v: CatalogValue) => {
    const to = v.status === 'Active' ? 'Inactive' : 'Active';
    setBusy(v.id); setMsg(null);
    try { await setValueStatus(def.category, v, to); setMsg({ tone: 'success', text: `“${v.name}” ${to === 'Inactive' ? 'deactivated' : 'reactivated'}.` }); setAttempt((x) => x + 1); }
    catch (e) { setMsg({ tone: 'error', text: (e as { message?: string })?.message || 'Could not save.' }); } finally { setBusy(null); }
  };
  const inactive = rows?.filter((r) => r.status !== 'Active').length ?? 0;
  const shown = (rows ?? []).filter((r) => showAll || r.status === 'Active').sort((a, b) => Number(b.status === 'Active') - Number(a.status === 'Active') || a.name.localeCompare(b.name));
  const id = `md-${def.category}`;
  return (
    <section className="rf2-panel rf2-admin__card" aria-labelledby={id}>
      <div className="rf2-row-between rf2-admin__head">
        <div><h2 id={id} className="rf2-jtable__name">{def.title}</h2><p className="rf2-jtable__sub">{def.hint}</p></div>
        {rows ? <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={() => { setAdding(true); setMsg(null); }} aria-label={`Add to ${def.title}`}>Add</ButtonV2> : null}
      </div>
      {rows === undefined && !error ? <SkeletonV2 lines={3} label={`Loading ${def.title}…`} /> : null}
      {error ? <p className="rf2-form-error rf2-admin__pad" role="alert">{error} <ButtonV2 kind="tertiary" size="sm" icon={<RotateCw />} onClick={() => setAttempt((x) => x + 1)}>Retry</ButtonV2></p> : null}
      {rows === null ? <p className="rf2-inline-note rf2-admin__pad" data-tone="warning"><Info aria-hidden="true" /> This list is not on this server yet.</p> : null}
      {msg ? <p className={msg.tone === 'error' ? 'rf2-form-error rf2-admin__pad' : 'rf2-inline-note rf2-admin__pad'} role={msg.tone === 'error' ? 'alert' : 'status'} data-tone={msg.tone}>{msg.text}</p> : null}
      {adding ? (
        <div className="rf2-admin__add">
          <InputV2 label={`New ${def.title.toLowerCase().replace(/s$/, '')}`} value={name} autoFocus onChange={(e) => { setName(e.target.value); setMsg(null); }} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
          <ButtonV2 size="sm" loading={busy === 'add'} onClick={() => void add()}>Save</ButtonV2>
          <ButtonV2 kind="tertiary" size="sm" onClick={() => { setAdding(false); setName(''); }}>Cancel</ButtonV2>
        </div>
      ) : null}
      {rows ? (
        <ul className="rf2-admin__values" aria-label={def.title}>
          {shown.map((v) => (
            <li key={v.id} data-inactive={v.status !== 'Active' || undefined}>
              <span>{v.name}</span>
              <StatusChip tone={v.status === 'Active' ? 'success' : 'neutral'} label={v.status === 'Active' ? 'Active' : 'Inactive'} />
              <ButtonV2 kind="tertiary" size="sm" icon={v.status === 'Active' ? <CircleMinus /> : <Undo2 />} loading={busy === v.id} disabled={busy !== null}
                onClick={() => void flip(v)} aria-label={`${v.status === 'Active' ? 'Deactivate' : 'Reactivate'} ${v.name}`} />
            </li>
          ))}
          {rows.length === 0 ? <li className="rf2-jtable__sub">Empty — add the first entry.</li> : null}
        </ul>
      ) : null}
      {inactive ? <ButtonV2 kind="tertiary" size="sm" className="rf2-admin__more" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Hide inactive' : `Show ${inactive} inactive`}</ButtonV2> : null}
    </section>
  );
}

function BandsCard() {
  const { user } = useAuth();
  const mayManage = canSeeBandAmounts(user?.permissions, (user?.roles ?? []).some((r) => r.code === 'ADMINISTRATOR'));
  const [bands, setBands] = useState<Band[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [edit, setEdit] = useState<Band | 'new' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setError(null);
    fetchBands().then((b) => live && setBands(b)).catch((e: { message?: string }) => live && setError(e?.message || 'Could not load.'));
    return () => { live = false; };
  }, [attempt]);
  const hidden = !!bands?.length && bands.every((b) => b.minMonthlyBase == null);
  return (
    <section className="rf2-panel rf2-admin__card" aria-labelledby="md-bands">
      <div className="rf2-row-between rf2-admin__head">
        <div><h2 id="md-bands" className="rf2-jtable__name">Grade bands</h2><p className="rf2-jtable__sub">Monthly basic pay range per grade and site; Approve is refused outside it</p></div>
        {bands ? <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={() => setEdit('new')}>Add band</ButtonV2> : null}
      </div>
      {bands === undefined && !error ? <SkeletonV2 lines={3} label="Loading grade bands…" /> : null}
      {error ? <p className="rf2-form-error rf2-admin__pad" role="alert">{error}</p> : null}
      {bands === null ? <p className="rf2-inline-note rf2-admin__pad" data-tone="warning"><Info aria-hidden="true" /> Grade bands are not on this server yet (B7).</p> : null}
      {msg ? <p className="rf2-inline-note rf2-admin__pad" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {msg}</p> : null}
      {hidden ? <p className="rf2-inline-note rf2-admin__pad"><Info aria-hidden="true" /> {mayManage ? 'Amounts are not returned by this server yet (Admins with MASTER_DATA_MANAGE will see them). You can still add bands, replace amounts and change status.' : 'Amounts are hidden: you need MASTER_DATA_MANAGE to see them. You can still change a band’s status.'}</p> : null}
      {bands?.length ? (
        <table className="rf2-jtable" aria-label="Grade bands">
          <thead><tr><th scope="col">Grade</th><th scope="col">Site</th><th scope="col">Currency</th><th scope="col" className="rf2-num">Min</th><th scope="col" className="rf2-num">Max</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-only">Actions</span></th></tr></thead>
          <tbody>{bands.map((b) => (
            <tr key={b.id} data-inactive={b.status !== 'Active' || undefined}>
              <th scope="row">{b.grade?.name ?? '—'}</th><td>{b.site?.name ?? '—'}</td><td>{b.currency}</td>
              <td className="rf2-num">{fmt(b.minMonthlyBase)}</td><td className="rf2-num">{fmt(b.maxMonthlyBase)}</td>
              <td><StatusChip tone={b.status === 'Active' ? 'success' : 'neutral'} label={b.status} /></td>
              <td><ButtonV2 kind="tertiary" size="sm" onClick={() => setEdit(b)} aria-label={`Edit ${b.grade?.name ?? 'band'} ${b.site?.name ?? ''}`}>Edit</ButtonV2></td>
            </tr>
          ))}</tbody>
        </table>
      ) : bands ? <p className="rf2-jtable__sub rf2-admin__pad">No bands yet. Approve is refused with GRADE_BAND_MISSING until a band exists.</p> : null}
      {edit ? <BandDrawer band={edit === 'new' ? null : edit} amountsHidden={hidden} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); setMsg(m); setAttempt((x) => x + 1); }} /> : null}
    </section>
  );
}

function BandDrawer({ band, amountsHidden, onClose, onDone }: { band: Band | null; amountsHidden: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [opts, setOpts] = useState<{ grades: CatalogValue[]; branches: CatalogValue[] } | null>(null);
  const [f, setF] = useState({ gradeId: band?.grade?.id ?? '', branchId: band?.site?.id ?? '', currency: band?.currency ?? 'EGP', min: band?.minMonthlyBase?.toString() ?? '', max: band?.maxMonthlyBase?.toString() ?? '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { void Promise.all([fetchOptions('grades'), fetchOptions('branches')]).then(([grades, branches]) => setOpts({ grades, branches })).catch(() => setOpts({ grades: [], branches: [] })); }, []);
  const amountsTouched = f.min !== (band?.minMonthlyBase?.toString() ?? '') || f.max !== (band?.maxMonthlyBase?.toString() ?? '');
  const save = async () => {
    const e: Record<string, string> = {};
    if (!band && !f.gradeId) e.gradeId = 'Pick a grade.';
    if (!band && !f.branchId) e.branchId = 'Pick a site.';
    const min = Number(f.min), max = Number(f.max);
    if (!band || amountsTouched) {
      if (!(f.min.trim() && min > 0)) e.min = 'Enter the minimum (above 0).';
      if (!(f.max.trim() && max > 0)) e.max = 'Enter the maximum (above 0).';
      else if (max < min) e.max = 'Maximum must be at least the minimum.';
    }
    setErrs(e); if (Object.keys(e).length) return;
    setBusy('save');
    try {
      if (band) await updateBand(band.id, { currency: f.currency, ...(amountsTouched ? { minMonthlyBase: min, maxMonthlyBase: max } : {}) });
      else await createBand({ gradeId: f.gradeId, branchId: f.branchId, currency: f.currency, minMonthlyBase: min, maxMonthlyBase: max });
      onDone(band ? 'Band updated.' : 'Band added.');
    } catch (x) { setErrs({ form: (x as { message?: string })?.message || 'Could not save.' }); } finally { setBusy(null); }
  };
  const flip = async () => {
    if (!band) return;
    setBusy('status');
    try { await updateBand(band.id, { status: band.status === 'Active' ? 'Inactive' : 'Active' }); onDone(band.status === 'Active' ? 'Band deactivated.' : 'Band reactivated.'); }
    catch (x) { setErrs({ form: (x as { message?: string })?.message || 'Could not save.' }); } finally { setBusy(null); }
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Grade band" title={band ? `${band.grade?.name ?? 'Band'} · ${band.site?.name ?? ''}` : 'Add grade band'}
      primaryAction={<ButtonV2 loading={busy === 'save'} disabled={busy !== null} onClick={() => void save()}>{band ? 'Save band' : 'Add band'}</ButtonV2>}
      secondaryAction={band ? <ButtonV2 kind="secondary" loading={busy === 'status'} disabled={busy !== null} onClick={() => void flip()}>{band.status === 'Active' ? 'Deactivate' : 'Reactivate'}</ButtonV2> : <ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      {!band ? (
        <div className="rf2-req__row">
          <SelectV2 label="Grade" required value={f.gradeId} onChange={(e) => setF({ ...f, gradeId: e.target.value })} error={errs.gradeId} disabled={!opts}>
            <option value="">Choose</option>{(opts?.grades ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </SelectV2>
          <SelectV2 label="Site" required value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })} error={errs.branchId} disabled={!opts}>
            <option value="">Choose</option>{(opts?.branches ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </SelectV2>
        </div>
      ) : null}
      <SelectV2 label="Currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
        {[...new Set([f.currency, 'EGP', 'AED', 'SAR'])].map((c) => <option key={c} value={c}>{c}</option>)}
      </SelectV2>
      <div className="rf2-req__row">
        <InputV2 label="Min monthly basic" type="number" min={0} required={!band} value={f.min} placeholder={amountsHidden ? 'Hidden' : undefined} onChange={(e) => setF({ ...f, min: e.target.value })} error={errs.min} />
        <InputV2 label="Max monthly basic" type="number" min={0} required={!band} value={f.max} placeholder={amountsHidden ? 'Hidden' : undefined} onChange={(e) => setF({ ...f, max: e.target.value })} error={errs.max} />
      </div>
      {band && amountsHidden ? <p className="rf2-jtable__sub">Leave the amounts empty to keep them; type both to replace them.</p> : null}
      {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
    </DrawerV2>
  );
}
