
export function StatesFeedbackPage() {
  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Application States & Feedback Patterns</h1>
          <p className="page-subtitle">Showcase of empty, loading, error, and feedback states.</p>
        </div>
      </header>

      <div className="grid c2">
        <div className="card">
          <h3>1. Loading State</h3>
          <div style={{ marginTop: '16px' }}>
            <div className="skeleton" style={{ height: '24px', width: '40%', marginBottom: '12px', background: 'var(--surface-muted)', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '100%', marginBottom: '8px', background: 'var(--surface-muted)', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '16px', background: 'var(--surface-muted)', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ height: '40px', width: '100%', background: 'var(--surface-muted)', borderRadius: 'var(--radius)' }}></div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
          <h3>2. Empty State</h3>
          <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--text-muted)' }}>📭</div>
          <h4 style={{ marginBottom: '8px' }}>No Vacancies Found</h4>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>You haven't created any vacancy requests yet.</p>
          <button className="button button-primary">Create Vacancy Request</button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
          <h3>3. Permission Denied</h3>
          <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--danger)' }}>🔒</div>
          <h4 style={{ marginBottom: '8px' }}>Access Restricted</h4>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>You do not have the required permissions to view this module.</p>
          <button className="button button-outline">Request Access</button>
        </div>

        <div className="card">
          <h3>4. Form Validation Error</h3>
          <div style={{ marginTop: '16px' }}>
            <label className="field-group">
              <span>Salary Range <span style={{ color: 'var(--danger)' }}>*</span></span>
              <input type="text" className="input" defaultValue="abc" style={{ borderColor: 'var(--danger)' }} />
              <span className="error-message" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Salary must be a valid number.</span>
            </label>
          </div>
        </div>

        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius)', width: '80%', maxWidth: '300px' }}>
              <h4 style={{ marginBottom: '8px' }}>Delete Candidate?</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>This action cannot be undone and will remove all associated documents.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="button button-sm button-outline">Cancel</button>
                <button className="button button-sm button-danger">Delete</button>
              </div>
            </div>
          </div>
          <h3>5. Destructive Action Modal</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Previewing the confirmation modal overlay.</p>
          <div style={{ height: '100px' }}></div>
        </div>

        <div className="card">
          <h3>6. System Error Recovery</h3>
          <div className="callout callout-danger" style={{ marginTop: '16px', padding: '16px', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
            <strong style={{ display: 'block', marginBottom: '8px' }}>Connection Error</strong>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px' }}>Failed to connect to the recruitment API. Please check your network connection.</p>
            <button className="button button-sm button-danger" style={{ background: 'transparent', border: '1px solid currentColor', color: 'currentColor' }}>Retry Request</button>
          </div>
        </div>
      </div>
    </div>
  );
}
