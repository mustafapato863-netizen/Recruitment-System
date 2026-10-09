import { useMemo, useState } from 'react';
import { CalendarPlus, CalendarCheck } from 'lucide-react';
import { ButtonV2, DrawerV2, InputV2, SelectV2, UserPicker } from '../components/v2';
import type { DrawerStatus, UserOption, UserPickerAdapter } from '../components/v2';

// Mocked people. No pay data anywhere.
const PEOPLE: UserOption[] = [
  { id: 'u1', name: 'Karim Hassan', detail: 'Manager · IT' },
  { id: 'u2', name: 'Mariam Farag', detail: 'Recruiter-offshore' },
  { id: 'u3', name: 'Hala Mostafa', detail: 'Manager · Talent' },
  { id: 'u4', name: 'Ahmed Fathy', detail: 'Recruiter-onshore' },
  { id: 'u5', name: 'Rasha Nabil', detail: 'Recruiter-clinical', disabledReason: 'Invited, not active yet' },
  { id: 'u6', name: 'Omar Khalil', detail: 'Admin · HR Systems' },
  { id: 'u7', name: 'Youssef Ibrahim', detail: 'Recruiter-onshore' },
];

function mockAdapter(mode: 'ok' | 'empty' | 'slow' | 'error'): UserPickerAdapter {
  return {
    search: (q, signal) => new Promise((resolve, reject) => {
      const t = window.setTimeout(() => {
        if (mode === 'error') return reject(new Error('boom'));
        if (mode === 'empty') return resolve([]);
        const s = q.toLowerCase();
        resolve(PEOPLE.filter((p) => p.name.toLowerCase().includes(s) || (p.detail ?? '').toLowerCase().includes(s)));
      }, mode === 'slow' ? 60_000 : 150);
      signal.addEventListener('abort', () => window.clearTimeout(t));
    }),
  };
}

export function DrawerPreviewV2() {
  const params = new URLSearchParams(window.location.search);
  const [open, setOpen] = useState(params.get('open') !== '0');
  const status = (params.get('status') ?? 'ready') as DrawerStatus;
  const ok = useMemo(() => mockAdapter('ok'), []);
  const empty = useMemo(() => mockAdapter('empty'), []);
  const slow = useMemo(() => mockAdapter('slow'), []);
  const [interviewers, setInterviewers] = useState<UserOption[]>([PEOPLE[0], PEOPLE[2]]);
  const [owner, setOwner] = useState<UserOption | null>(PEOPLE[1]);
  const [a, setA] = useState<UserOption | null>(null);
  const [b, setB] = useState<UserOption | null>(null);

  return (
    <main style={{ fontFamily: 'var(--rf2-font)', color: 'var(--rf2-ink)', background: 'var(--rf2-canvas)', minHeight: '100vh', padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Drawer + UserPicker <span style={{ fontSize: 12, color: 'var(--rf2-muted)' }}>dev preview · data-ui="v2"</span></h1>
      <p style={{ margin: '0 0 24px', color: 'var(--rf2-ink-2)' }}>E15 Schedule interview, mocked data. Query: ?open=0, ?status=loading|error|forbidden.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 320px 320px', gap: 24, alignItems: 'start' }}>
        <div><ButtonV2 kind="secondary" icon={<CalendarPlus />} onClick={() => setOpen(true)} id="open-drawer">Schedule interview</ButtonV2></div>
        <div id="picker-empty"><UserPicker label="Empty source" adapter={empty} value={a} onChange={setA} /></div>
        <div id="picker-loading"><UserPicker label="Loading source" adapter={slow} value={b} onChange={setB} /></div>
      </div>

      <DrawerV2
        open={open}
        onClose={() => setOpen(false)}
        kicker="Interview · HRIS Developer"
        title="Schedule interview — Ahmed Embaby"
        subtitle="Interviewer is a user. The link is a room URL."
        status={status}
        onRetry={() => undefined}
        confirmClose={() => true}
        secondaryAction={<ButtonV2 kind="secondary" onClick={() => setOpen(false)}>Cancel</ButtonV2>}
        primaryAction={<ButtonV2 kind="primary" icon={<CalendarCheck />}>Schedule</ButtonV2>}
      >
        <SelectV2 label="Interview type" defaultValue="tech"><option value="tech">Technical</option><option value="hr">HR</option></SelectV2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InputV2 label="Date" type="date" defaultValue="2026-10-14" required />
          <InputV2 label="Time" type="time" defaultValue="11:30" required />
        </div>
        <div id="picker-multi"><UserPicker multiple label="Interviewers" adapter={ok} value={interviewers} onChange={setInterviewers} required hint="Named interviewers can read the CV and submit the scorecard, nothing else." /></div>
        <div id="picker-single"><UserPicker label="Owner" adapter={ok} value={owner} onChange={setOwner} /></div>
        <InputV2 label="Room URL" type="url" placeholder="https://meet.example.com/room/…" />
      </DrawerV2>
    </main>
  );
}
