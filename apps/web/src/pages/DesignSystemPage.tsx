
export function DesignSystemPage() {
  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">RecruitFlow Design System</h1>
          <p className="page-subtitle">Standardized visual language and UI components.</p>
        </div>
        <div className="page-actions">
          <button className="button button-outline">Export Tokens</button>
        </div>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>1. Brand & Semantic Colors</h2>
        <div className="grid c5">
          {[
            { name: 'Primary', hex: '#7C3AED', var: '--primary', bg: 'var(--primary)', color: 'white' },
            { name: 'Secondary', hex: '#2563EB', var: '--info', bg: 'var(--info)', color: 'white' },
            { name: 'Success', hex: '#16A34A', var: '--success', bg: 'var(--success)', color: 'white' },
            { name: 'Warning', hex: '#D97706', var: '--warning', bg: 'var(--warning)', color: 'white' },
            { name: 'Danger', hex: '#DC2626', var: '--danger', bg: 'var(--danger)', color: 'white' },
          ].map((c) => (
            <div key={c.name} className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ height: '80px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, fontWeight: 'bold' }}>{c.hex}</div>
              <div style={{ padding: '12px' }}>
                <strong style={{ display: 'block' }}>{c.name}</strong>
                <small style={{ color: 'var(--text-muted)' }}>{c.var}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>2. Typography Hierarchy</h2>
        <div className="card">
          <div style={{ marginBottom: '24px' }}>
            <h1>Heading 1 (H1)</h1>
            <small style={{ color: 'var(--text-muted)' }}>Used for Page Titles (24px/32px)</small>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <h2>Heading 2 (H2)</h2>
            <small style={{ color: 'var(--text-muted)' }}>Used for Section Headings (20px/28px)</small>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <h3>Heading 3 (H3)</h3>
            <small style={{ color: 'var(--text-muted)' }}>Used for Card Titles (16px/24px)</small>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <p>Body Text</p>
            <small style={{ color: 'var(--text-muted)' }}>Default text for paragraphs, labels, and table content (14px/20px). Lorem ipsum dolor sit amet, consectetur adipiscing elit.</small>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Caption Text</p>
            <small style={{ color: 'var(--text-muted)' }}>Used for metadata, helper text, and timestamps (12px/16px)</small>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>3. Component Library Showcase</h2>
        <div className="grid c2">
          <div className="card">
            <h3>Buttons</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
              <button className="button button-primary">Primary Button</button>
              <button className="button button-outline">Outline Button</button>
              <button className="button button-danger">Danger Button</button>
              <button className="button" disabled>Disabled Button</button>
            </div>
          </div>

          <div className="card">
            <h3>Badges</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
              <span className="badge badge-success">Success Badge</span>
              <span className="badge badge-warning">Warning Badge</span>
              <span className="badge badge-danger">Danger Badge</span>
              <span className="badge badge-info">Info Badge</span>
              <span className="badge badge-neutral">Neutral Badge</span>
            </div>
          </div>

          <div className="card">
            <h3>Form Inputs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <label className="field-group">
                <span>Text Input</span>
                <input type="text" className="input" placeholder="Enter text..." />
              </label>
              <label className="field-group">
                <span>Select Input</span>
                <select className="input"><option>Option 1</option><option>Option 2</option></select>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>Alerts & Banners</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="callout callout-info" style={{ padding: '12px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', borderRadius: 'var(--radius)' }}>
                <strong>Info Alert:</strong> This is a piece of informational feedback.
              </div>
              <div className="callout callout-warning" style={{ padding: '12px', background: 'rgba(217, 119, 6, 0.1)', color: '#D97706', borderRadius: 'var(--radius)' }}>
                <strong>Warning Alert:</strong> Attention is required before proceeding.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
