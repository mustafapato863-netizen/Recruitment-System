import { useRef, useState } from 'react';
import { ArrowUpRight, Search, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DrawerV2 } from '../Drawer';
import type { SeatNavItem } from './navConfig';

const GROUPS = [
  { label: 'Hiring operations', keys: ['classic-final-approvals', 'classic-hires', 'classic-licenses', 'classic-joinings', 'classic-interviews', 'classic-calendar', 'classic-offers', 'classic-vacancies'] },
  { label: 'Candidates & imports', keys: ['classic-candidates', 'classic-cv-bank', 'classic-talent-pools', 'classic-import'] },
  { label: 'People & access', keys: ['roles', 'classic-access', 'classic-targets'] },
  { label: 'Workspace settings', keys: ['pipeline', 'master-data', 'templates', 'audit', 'integrations', 'classic-master-data', 'classic-settings', 'classic-pipeline'] },
];

/** Receives only the shell's permission-filtered destinations. No additional access is granted here. */
export function WorkspaceTools({ items, activeKey, collapsed, admin }: {
  items: SeatNavItem[]; activeKey?: string; collapsed: boolean; admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const label = admin ? 'Settings & tools' : 'Workspace tools';
  const active = items.some((item) => item.key === activeKey);
  const term = query.trim().toLowerCase();
  const filtered = items.filter((item) => `${item.label} ${GROUPS.find((group) => group.keys.includes(item.key))?.label ?? ''}`.toLowerCase().includes(term));
  // Keep future destinations discoverable even before a grouping entry is added.
  const orderedGroups = admin ? [...GROUPS.slice(2), ...GROUPS.slice(0, 2)] : GROUPS;
  const groups = [...orderedGroups, { label: 'Other tools', keys: items.filter((item) => !GROUPS.some((group) => group.keys.includes(item.key))).map((item) => item.key) }];

  if (!items.length) return null;
  return <>
    <button type="button" className="rf2-nav-item rf2-tools-trigger" aria-haspopup="dialog" aria-expanded={open}
      aria-label={label} title={collapsed ? label : undefined} data-active={active || undefined}
      onClick={() => { setQuery(''); setOpen(true); }}>
      <Settings2 aria-hidden="true" /><span className="rf2-nav-item__label">{label}</span>
    </button>
    <DrawerV2 open={open} onClose={() => setOpen(false)} title={label}
      subtitle="Find an occasional task here. Your daily work stays in the main menu." initialFocusRef={searchRef}>
      <label className="rf2-tools-search">
        <span className="rf2-sr-only">Find a tool</span><Search aria-hidden="true" />
        <input ref={searchRef} type="search" placeholder="Search tools, settings or tasks" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <nav aria-label={label} className="rf2-tools-groups">
        {groups.map((group) => {
          const links = filtered.filter((item) => group.keys.includes(item.key));
          if (!links.length) return null;
          return <section key={group.label} className="rf2-tools-group" aria-label={group.label}>
            <h3>{group.label}</h3><ul>
              {links.map((item) => <li key={item.key}><Link to={item.to} aria-current={item.key === activeKey ? 'page' : undefined}
                className="rf2-tools-link" onClick={() => setOpen(false)}><span>{item.label}</span><ArrowUpRight aria-hidden="true" /></Link></li>)}
            </ul>
          </section>;
        })}
      </nav>
      {!filtered.length ? <p role="status" className="rf2-tools-empty">No tools match “{query}”. Try another name.</p> : null}
    </DrawerV2>
  </>;
}
