import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * Compatibility entry point. Stage work now lives in Applicant Profile; old
 * links keep working and can request the corresponding workspace tab with
 * `?stage=Screening` or `?targetStage=Screening`.
 */
export function StageTransitionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const requestedStage = query.get('stage') || query.get('targetStage');
  const destination = requestedStage && id
    ? `/applications/${id}?stage=${encodeURIComponent(requestedStage)}`
    : `/applications/${id ?? ''}`;

  return <Navigate to={destination} replace />;
}

export default StageTransitionPage;
