import { Briefcase, Eye, ListChecks, Plus, Search, Send, Trash2, Users } from 'lucide-react';
import {
  ButtonV2, CardV2, DangerConfirmButton, EmptyStateV2, ForbiddenStateV2, InputV2, NavItem, NavList, SelectV2,
  SkeletonV2, StatusChip, TableCellV2, TableRowV2, TableV2,
} from '../components/v2';
import type { ButtonV2Kind } from '../components/v2';

// data-force="hover|active|focus-visible" is applied by the screenshot script via
// CDP CSS.forcePseudoState, so every state can be captured statically.
const kinds: ButtonV2Kind[] = ['primary', 'secondary', 'tertiary', 'danger', 'danger-outline'];
const states = ['default', 'hover', 'focus-visible', 'pressed', 'selected', 'disabled', 'loading'] as const;

const box: React.CSSProperties = { background: 'var(--rf2-card)', border: '1px solid var(--rf2-divider)', borderRadius: 'var(--rf2-radius-card)', padding: 24, marginBottom: 24 };
const h2: React.CSSProperties = { fontSize: 'var(--rf2-text-section)', lineHeight: 'var(--rf2-leading-section)', fontWeight: 700, margin: '0 0 16px' };
const cap: React.CSSProperties = { fontSize: 12, color: 'var(--rf2-muted)', fontWeight: 500 };

function forceAttr(state: string) {
  return state === 'hover' ? 'hover' : state === 'pressed' ? 'active' : state === 'focus-visible' ? 'focus-visible' : undefined;
}

export function PrimitivesPreviewV2() {
  return (
    <main style={{ fontFamily: 'var(--rf2-font)', color: 'var(--rf2-ink)', background: 'var(--rf2-canvas)', minHeight: '100vh', padding: 32 }}>
      <h1 style={{ fontSize: 'var(--rf2-text-page)', lineHeight: 'var(--rf2-leading-page)', fontWeight: 700, margin: '0 0 24px' }}>
        RecruitFlow v2 primitives <span style={cap}>dev preview · data-ui="v2"</span>
      </h1>

      <section style={box} id="buttons">
        <h2 style={h2}>Button · kinds × states (md 36px)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${states.length}, 1fr)`, gap: 12, alignItems: 'center' }}>
          <span />
          {states.map((s) => <span key={s} style={cap}>{s}</span>)}
          {kinds.map((k) => (
            <div key={k} style={{ display: 'contents' }}>
              <span style={cap}>{k}</span>
              {states.map((s) => (
                <div key={s}>
                  <ButtonV2 kind={k} icon={k.startsWith('danger') ? <Trash2 /> : <Plus />} data-force={forceAttr(s)}
                    disabled={s === 'disabled'} loading={s === 'loading'} selected={s === 'selected' ? true : undefined}>
                    Button
                  </ButtonV2>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20 }}>
          <span style={cap}>sizes</span>
          <ButtonV2 size="sm" icon={<Plus />}>Small 32</ButtonV2>
          <ButtonV2 size="md" icon={<Plus />}>Medium 36</ButtonV2>
          <ButtonV2 size="lg" icon={<Plus />}>Large 44</ButtonV2>
          <ButtonV2 kind="secondary" icon={<Send />} iconPosition="end">Icon end</ButtonV2>
          <span style={cap}>confirm pattern</span>
          <DangerConfirmButton icon={<Trash2 />} confirmLabel="Confirm reject" onConfirm={() => undefined}>Reject</DangerConfirmButton>
          <DangerConfirmButton icon={<Trash2 />} confirmLabel="Confirm reject" onConfirm={() => undefined} data-arm="true">Reject</DangerConfirmButton>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <section style={box} id="chips">
          <h2 style={h2}>StatusChip · tones</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusChip tone="success" label="Joined" />
            <StatusChip tone="warning" label="Scorecard missing" />
            <StatusChip tone="danger" label="Follow-up overdue 2d" />
            <StatusChip tone="info" label="Interview" />
            <StatusChip tone="neutral" label="Waiting on Karim Hassan" />
          </div>
        </section>
        <section style={{ ...box, background: 'var(--rf2-nav)' }} id="nav">
          <h2 style={{ ...h2, color: 'var(--rf2-on-action)' }}>NavItem · default / hover / focus / pressed / selected</h2>
          <div style={{ width: 240 }}>
            <NavList label="Preview navigation">
              <NavItem href="#" icon={<ListChecks />} label="My Work" active badge={3} />
              <NavItem href="#" icon={<Briefcase />} label="Open jobs (hover)" data-force="hover" />
              <NavItem href="#" icon={<Users />} label="Candidates (focus)" data-force="focus-visible" />
              <NavItem href="#" icon={<Users />} label="Pressed" data-force="active" />
              <NavItem href="#" icon={<Users />} label="Not permitted (absent)" permitted={false} />
            </NavList>
          </div>
        </section>
      </div>

      <section style={box} id="fields">
        <h2 style={h2}>Input / Select · states</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <InputV2 label="Default" defaultValue="Value" />
          <InputV2 label="Empty (placeholder)" placeholder="Search candidates" leadingIcon={<Search />} />
          <InputV2 label="Hover" defaultValue="Value" data-force-box="hover" />
          <InputV2 label="Focus-visible" defaultValue="Value" data-force-box="focus" />
          <InputV2 label="Required + hint" required hint="As written on the ID." defaultValue="" placeholder="Full name" />
          <InputV2 label="Error" defaultValue="mariam@" error="Enter a full email address." />
          <InputV2 label="Warning" defaultValue="19 Oct 2026" warning="Due in 9 days." />
          <InputV2 label="Success" defaultValue="SCFHS-123456" success="Licence verified." />
          <InputV2 label="Disabled" defaultValue="Locked by gate" disabled />
          <InputV2 label="Read-only" defaultValue="HRIS Developer" readOnly />
          <SelectV2 label="Select" defaultValue="cairo"><option value="cairo">Offshore Cairo</option><option value="riyadh">SGH Riyadh</option></SelectV2>
          <SelectV2 label="Select empty" placeholder="Choose a site" defaultValue=""><option value="cairo">Offshore Cairo</option></SelectV2>
          <SelectV2 label="Select error" defaultValue="" placeholder="Choose a grade" error="Grade is required."><option value="8">Grade 8</option></SelectV2>
          <SelectV2 label="Select disabled" defaultValue="cairo" disabled><option value="cairo">Offshore Cairo</option></SelectV2>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        <CardV2 title="Static card" actions={<StatusChip tone="info" label="Interview" />}>HRIS Developer · IT · Offshore Cairo</CardV2>
        <CardV2 as="button" title="Interactive card (hover)" data-force="hover">Opens the file</CardV2>
        <CardV2 as="button" title="Selected card" selected>aria-pressed=true</CardV2>
        <CardV2 as="button" title="Focus-visible card" data-force="focus-visible">Keyboard focus</CardV2>
        <CardV2 as="button" title="Disabled card" disabled>Not available</CardV2>
        <CardV2 title="Warning tone" tone="warning">Scorecard missing — gate blocks Offer</CardV2>
      </div>

      <section style={{ ...box, marginTop: 24 }} id="table">
        <h2 style={h2}>Table row · default / hover / focus / selected / disabled</h2>
        <TableV2 label="Preview table" columns={[{ key: 'n', header: 'Candidate' }, { key: 'j', header: 'Job' }, { key: 'd', header: 'Days', numeric: true }, { key: 's', header: 'Status' }]}>
          <TableRowV2 onActivate={() => undefined}><TableCellV2 primary>Ahmed Embaby</TableCellV2><TableCellV2>HRIS Developer</TableCellV2><TableCellV2 numeric>3</TableCellV2><TableCellV2><StatusChip tone="warning" label="Scorecard missing" /></TableCellV2></TableRowV2>
          <TableRowV2 onActivate={() => undefined} data-force="hover"><TableCellV2 primary>Nourhan Sami (hover)</TableCellV2><TableCellV2>HRIS Developer</TableCellV2><TableCellV2 numeric>0</TableCellV2><TableCellV2><StatusChip tone="info" label="Screening" /></TableCellV2></TableRowV2>
          <TableRowV2 onActivate={() => undefined} data-force="focus-visible"><TableCellV2 primary>Lina Hassan (focus)</TableCellV2><TableCellV2>HRIS Developer</TableCellV2><TableCellV2 numeric>12</TableCellV2><TableCellV2><StatusChip tone="neutral" label="Waiting on Karim Hassan" /></TableCellV2></TableRowV2>
          <TableRowV2 onActivate={() => undefined} selected><TableCellV2 primary>Salma Adel (selected)</TableCellV2><TableCellV2>HRIS Developer</TableCellV2><TableCellV2 numeric>21</TableCellV2><TableCellV2><StatusChip tone="danger" label="Follow-up overdue 2d" /></TableCellV2></TableRowV2>
          <TableRowV2 disabled><TableCellV2 primary>Closed file (disabled)</TableCellV2><TableCellV2>Pharmacist</TableCellV2><TableCellV2 numeric>40</TableCellV2><TableCellV2><StatusChip tone="success" label="Joined" /></TableCellV2></TableRowV2>
        </TableV2>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        <EmptyStateV2 title="No open work assigned to you" body="New files on your jobs will appear here." action={<ButtonV2 kind="secondary" icon={<Eye />}>View open jobs</ButtonV2>} />
        <ForbiddenStateV2 action={<ButtonV2 kind="tertiary">Back to My Work</ButtonV2>} />
        <div style={box}><h2 style={h2}>Skeleton (loading)</h2><SkeletonV2 lines={4} label="Loading files" /></div>
      </div>
    </main>
  );
}
