import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function NotFoundPage() {
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
        className="card-neon-purple"
        style={{
          padding: '48px 40px',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Page Not Found</h1>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
          The page or resource you are looking for doesn&apos;t exist or has been moved to another workflow stage.
        </p>
        <div style={{ marginTop: '12px' }}>
          <Link
            to="/"
            className="button button-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              textDecoration: 'none',
            }}
          >
            <Icon name="dashboard" size={16} /> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
