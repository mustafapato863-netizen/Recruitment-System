import { Navigate } from 'react-router-dom';

/**
 * Talent Pools has been deprecated and replaced by Smart Sourcing & Match.
 * Automatically redirect any legacy routes to /sourcing-match.
 */
export function TalentPoolDetailPage() {
  return <Navigate to="/sourcing-match" replace />;
}
