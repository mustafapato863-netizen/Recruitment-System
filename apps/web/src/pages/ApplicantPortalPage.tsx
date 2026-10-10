import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Application, PaginatedResult } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { Drawer } from '../components/ui/Drawer';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

function stageClass(stage: Application['stage']): string {
  if (stage === 'Interview') return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80';
  if (stage === 'Offer' || stage === 'Pre-Hire') return 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/80';
  if (stage === 'Screening') return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80';
  return 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80';
}

export function ApplicantPortalPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'All' | 'In Progress' | 'Interview' | 'Offer'>('All');
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=100')
      .then((response) => { if (mounted) setApplications(response?.data || []); })
      .catch((error: unknown) => { if (mounted) { setApplications([]); setLoadError(error instanceof Error ? error.message : 'Unable to load applications.'); } });
    return () => { mounted = false; };
  }, []);

  const counts = useMemo(() => ({
    all: applications.length,
    inProgress: applications.filter((application) => application.stage === 'Screening' || application.stage === 'Applied').length,
    interview: applications.filter((application) => application.stage === 'Interview').length,
    offer: applications.filter((application) => application.stage === 'Offer' || application.stage === 'Pre-Hire').length,
  }), [applications]);

  const filtered = useMemo(() => applications.filter((application) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [application.applicationCode, application.positionTitle, application.vacancyCode, application.candidate ? `${application.candidate.firstName} ${application.candidate.lastName}` : ''].some((value) => value?.toLowerCase().includes(term));
    const matchesFilter = filter === 'All' || (filter === 'In Progress' && (application.stage === 'Applied' || application.stage === 'Screening')) || (filter === 'Interview' && application.stage === 'Interview') || (filter === 'Offer' && (application.stage === 'Offer' || application.stage === 'Pre-Hire'));
    return matchesQuery && matchesFilter;
  }), [applications, filter, query]);

  return (
    <PageFrame eyebrow="Applicant portal" title="My applications" description="Application status is loaded from the recruitment workflow in real time." actions={<button type="button" onClick={() => navigate('/applications')} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">View recruitment workspace</button>}>
      {loadError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{loadError}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
        {[['All', counts.all], ['In Progress', counts.inProgress], ['Interview', counts.interview], ['Offer', counts.offer]].map(([label, count]) => <button key={label} type="button" onClick={() => setFilter(label as typeof filter)} className={`rounded-2xl border p-4 text-left transition ${filter === label ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800/80'} bg-white dark:bg-slate-900`}><span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span><strong className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">{count}</strong></button>)}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2">{(['All', 'In Progress', 'Interview', 'Offer'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${filter === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700/60'}`}>{value}</button>)}</div><div className="relative"><Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applications" className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-64" /></div></div>
        {filtered.length === 0 ? <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400"><Icon name="inbox" size={24} className="mx-auto mb-2 text-slate-400" /><strong className="block text-slate-700 dark:text-slate-200">No applications found</strong><span className="text-xs">Applications will appear here after a candidate is submitted.</span></div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300"><tr><th className="p-4">Candidate</th><th className="p-4">Position</th><th className="p-4">Reference</th><th className="p-4">Stage</th><th className="p-4">Applied</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map((application) => <tr key={application.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelected(application)}><td className="p-4 font-semibold text-slate-900 dark:text-white">{application.candidate ? `${application.candidate.firstName} ${application.candidate.lastName}` : 'Candidate'}</td><td className="p-4 text-slate-600 dark:text-slate-300">{application.positionTitle || 'Position unavailable'}</td><td className="p-4 font-mono text-[10px] text-slate-500">{application.applicationCode}</td><td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${stageClass(application.stage)}`}>{application.stage}</span></td><td className="p-4 text-slate-500 dark:text-slate-400">{new Date(application.appliedAt).toLocaleDateString()}</td><td className="p-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(application); }} className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-blue-600 dark:border-slate-700 dark:text-sky-400">View</button></td></tr>)}</tbody></table></div>}
      </div>
      {selected && <Drawer isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected.positionTitle || 'Application'} subtitle={selected.applicationCode} width="standard"><div className="space-y-4 text-sm text-slate-700 dark:text-slate-300"><div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Current stage</span><span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${stageClass(selected.stage)}`}>{selected.stage}</span></div><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">Candidate</dt><dd className="font-semibold">{selected.candidate ? `${selected.candidate.firstName} ${selected.candidate.lastName}` : 'Candidate'}</dd></div><div><dt className="text-slate-500">Applied</dt><dd className="font-semibold">{new Date(selected.appliedAt).toLocaleDateString()}</dd></div><div><dt className="text-slate-500">Vacancy</dt><dd className="font-semibold">{selected.vacancyCode || '—'}</dd></div><div><dt className="text-slate-500">Recruiter</dt><dd className="font-semibold">{selected.primaryRecruiterName || 'Unassigned'}</dd></div></dl><button type="button" onClick={() => navigate(`/applications/${selected.id}`)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Open application</button></div></Drawer>}
    </PageFrame>
  );
}

export default ApplicantPortalPage;
