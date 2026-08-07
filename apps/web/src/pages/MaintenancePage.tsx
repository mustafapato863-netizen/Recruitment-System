import { useState } from 'react';
import { Spinner } from '../components/Spinner';
import { Icon } from '../components/Icon';

export function MaintenancePage() {
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
    }, 1200);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '75vh',
        textAlign: 'center',
        padding: '32px 16px',
        animation: 'fadeIn 0.4s ease-out',
      }}
    >
      <div
        className="card-neon-amber"
        style={{
          padding: '48px 40px',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(217, 119, 6, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d97706',
          }}
        >
          <Icon name="settings" size={32} />
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>System Maintenance in Progress</h1>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
          RecruitFlow is currently undergoing scheduled database maintenance and system upgrades to improve service performance.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: 'var(--surface-soft)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text)',
            marginTop: '8px',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706', animation: 'pulseGlow 1.5s infinite' }} />
          Estimated completion: ~15 minutes
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleCheckStatus}
            disabled={checking}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
          >
            {checking ? <Spinner size={16} /> : <Icon name="settings" size={16} />}
            {checking ? 'Checking...' : 'Check Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
