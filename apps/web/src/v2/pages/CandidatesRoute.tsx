import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { CandidatesV2 } from './CandidatesV2';
import { CompareV2 } from './CompareV2';

const CandidatesPage = lazy(() => import('../../pages/CandidatesPage').then((m) => ({ default: m.CandidatesPage })));
const CandidateComparisonPage = lazy(() => import('../../pages/CandidateComparisonPage').then((m) => ({ default: m.CandidateComparisonPage })));

/** /candidates: E23 for the v2 Employee seat; v1 otherwise. */
export function CandidatesListRoute() { return useV2Shell()?.seat === 'employee' ? <CandidatesV2 /> : <CandidatesPage />; }
/** /candidates/compare: E24 for the v2 Employee seat; v1 otherwise. */
export function CandidatesCompareRoute() { return useV2Shell()?.seat === 'employee' ? <CompareV2 /> : <CandidateComparisonPage />; }
