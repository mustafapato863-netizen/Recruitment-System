import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isRecruiterOnly } from '../v2/destinations';

/** Backend #21 (B2-3): the Recruiter role gets 403 on requisitions, so its routes send that user home. */
export function RequisitionsGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && isRecruiterOnly(user.roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
