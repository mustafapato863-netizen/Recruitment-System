const colours = [
  'ink', 'ink-2', 'muted', 'action', 'action-hover', 'canvas', 'card', 'border', 'divider', 'nav', 'nav-text',
  'success', 'warning', 'danger', 'info', 'success-tint', 'warning-tint', 'danger-tint', 'info-tint', 'neutral-tint',
];
const type = [
  ['page', 'Page title · 24 Bold'], ['section', 'Section heading · 18 Bold'], ['card', 'Card title · 16 SemiBold'],
  ['body', 'Body text · 14 Regular. Fit is always a written note with evidence.'], ['label', 'FIELD LABEL · 13 SemiBold'], ['caption', 'Caption · 12 Medium'],
] as const;
const space = ['0-5', '1', '1-5', '2', '3', '4', '5', '6', '8'];

const section: React.CSSProperties = {
  background: 'var(--rf2-card)', border: '1px solid var(--rf2-divider)', borderRadius: 'var(--rf2-radius-card)',
  padding: 'var(--rf2-space-3)', marginBottom: 'var(--rf2-space-3)',
};
const h2: React.CSSProperties = { fontSize: 'var(--rf2-text-section)', lineHeight: 'var(--rf2-leading-section)', fontWeight: 700, margin: '0 0 var(--rf2-space-2)' };

export function TokenPreviewV2() {
  return (
    <main style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-950)', background: 'var(--color-canvas)', minHeight: '100vh', padding: 'var(--rf2-space-4, 32px)' }}>
      <h1 style={{ fontSize: 'var(--rf2-text-page)', lineHeight: 'var(--rf2-leading-page)', fontWeight: 700, margin: '0 0 var(--rf2-space-3)' }}>
        RecruitFlow v2 tokens <small style={{ fontSize: 12, color: 'var(--rf2-muted)', fontWeight: 500 }}>dev preview · data-ui="v2"</small>
      </h1>

      <section style={section}>
        <h2 style={h2}>Colour</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 'var(--rf2-space-2)' }}>
          {colours.map((c) => (
            <div key={c}>
              <div style={{ height: 56, borderRadius: 'var(--rf2-radius-card)', background: `var(--rf2-${c})`, border: '1px solid var(--rf2-divider)' }} />
              <div style={{ fontSize: 12, lineHeight: '16px', marginTop: 4 }}>--rf2-{c}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Type · Plus Jakarta Sans</h2>
        {type.map(([k, label]) => (
          <div key={k} style={{ fontSize: `var(--rf2-text-${k})`, lineHeight: `var(--rf2-leading-${k})`, fontWeight: `var(--rf2-weight-${k})` as unknown as number, marginBottom: 8 }}>{label}</div>
        ))}
        <div style={{ fontSize: 14, marginTop: 12 }}>
          Proportional: <span>1,111.10 / 9,999.90</span> · Tabular (.rf2-num): <span className="rf2-num">1,111.10 / 9,999.90</span>
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Spacing (8px grid) · Radius · Shadow</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--rf2-space-2)', marginBottom: 'var(--rf2-space-3)' }}>
          {space.map((s) => (
            <div key={s} style={{ textAlign: 'center', fontSize: 12 }}>
              <div style={{ width: `var(--rf2-space-${s})`, height: `var(--rf2-space-${s})`, background: 'var(--rf2-action)' }} />
              {s}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--rf2-space-3)' }}>
          {(['control', 'card', 'drawer'] as const).map((r) => (
            <div key={r} style={{ width: 140, height: 72, border: '1px solid var(--rf2-border)', borderRadius: `var(--rf2-radius-${r})`, display: 'grid', placeItems: 'center', fontSize: 13 }}>radius-{r}</div>
          ))}
          <div style={{ width: 160, height: 72, background: 'var(--rf2-card)', borderRadius: 'var(--rf2-radius-card)', boxShadow: 'var(--rf2-shadow-menu)', display: 'grid', placeItems: 'center', fontSize: 13 }}>shadow-menu</div>
          <div style={{ width: 160, height: 72, background: 'var(--rf2-card)', borderRadius: 'var(--rf2-radius-drawer)', boxShadow: 'var(--rf2-shadow-overlay)', display: 'grid', placeItems: 'center', fontSize: 13 }}>shadow-overlay</div>
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Buttons on tokens · focus ring</h2>
        <div style={{ display: 'flex', gap: 'var(--rf2-space-2)', alignItems: 'center' }}>
          <button type="button" style={{ background: 'var(--rf2-action)', color: 'var(--rf2-on-action)', border: 0, borderRadius: 'var(--rf2-radius-control)', padding: '8px 16px', font: 'inherit', fontSize: 14, fontWeight: 600, transition: 'background var(--rf2-motion-fast) var(--rf2-ease)' }}>Primary action</button>
          <button type="button" style={{ background: 'var(--rf2-action-hover)', color: 'var(--rf2-on-action)', border: 0, borderRadius: 'var(--rf2-radius-control)', padding: '8px 16px', font: 'inherit', fontSize: 14, fontWeight: 600 }}>Primary · hover</button>
          <button type="button" style={{ background: 'var(--rf2-card)', color: 'var(--rf2-ink)', border: '1px solid var(--rf2-border)', borderRadius: 'var(--rf2-radius-control)', padding: '8px 16px', font: 'inherit', fontSize: 14, fontWeight: 600 }}>Secondary</button>
          <button type="button" style={{ background: 'transparent', color: 'var(--rf2-action)', border: 0, padding: '8px 16px', font: 'inherit', fontSize: 14, fontWeight: 600 }}>Tertiary</button>
          <button type="button" style={{ background: 'var(--rf2-card)', color: 'var(--rf2-ink)', border: '1px solid var(--rf2-border)', borderRadius: 'var(--rf2-radius-control)', padding: '8px 16px', font: 'inherit', fontSize: 14, fontWeight: 600, boxShadow: 'var(--rf2-focus-ring)' }}>Focus ring (2px)</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--rf2-space-1)', marginTop: 'var(--rf2-space-2)' }}>
          {(['success', 'warning', 'danger', 'info'] as const).map((s) => (
            <span key={s} style={{ background: `var(--rf2-${s}-tint)`, color: `var(--rf2-${s})`, borderRadius: 'var(--rf2-radius-pill)', padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>● {s}</span>
          ))}
          <span style={{ background: 'var(--rf2-neutral-tint)', color: 'var(--rf2-ink-2)', borderRadius: 'var(--rf2-radius-pill)', padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>● neutral</span>
        </div>
      </section>
    </main>
  );
}
