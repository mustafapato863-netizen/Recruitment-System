/**
 * Preloads lazy route chunks on navigation hover/focus and during browser idle time
 * so sidebar and tab switches never stall on Suspense fallbacks.
 */

const ROUTE_CHUNK_LOADERS: Record<string, () => Promise<unknown>> = {
  '/my-work': () => import('./pages/MyWorkRoute'),
  '/team-work': () => import('./pages/TeamWorkV2'),
  '/approvals': () => import('./pages/TeamWorkV2'),
  '/vacancies': () => import('./pages/JobsRoute'),
  '/candidates': () => import('./pages/CandidatesRoute'),
  '/vacancy-requests': () => import('./pages/RequisitionsRoute'),
  '/team-interviews': () => import('./pages/TeamInterviewsV2'),
  '/interviews': () => import('./pages/TeamInterviewsV2'),
  '/my-interviews': () => import('./pages/MyInterviewsV2'),
  '/joinings': () => import('./pages/JoiningV2'),
  '/reports': () => import('./pages/ReportsRoute'),
  '/sourcing-match': () => import('./pages/MatchSkillsV2'),
  '/cv-bank': () => import('./pages/CvBankV2'),
  '/licenses': () => import('./admin/LicenseManagementV2'),
  '/users': () => import('./admin/AdminRoutes'),
  '/roles': () => import('./admin/AdminRoutes'),
  '/master-data': () => import('./admin/AdminRoutes'),
  '/pipeline-settings': () => import('./admin/AdminRoutes'),
  '/whatsapp-templates': () => import('./admin/AdminRoutes'),
  '/audit-log': () => import('./admin/AdminRoutes'),
  '/integrations': () => import('./admin/AdminRoutes'),
  '/notifications': () => import('./pages/NotificationsV2'),
  '/profile': () => import('./pages/ProfileV2'),
};

const warmed = new Set<string>();

export function preloadRouteChunk(to: string): void {
  const path = to.split('?')[0].split('#')[0];
  if (!path || warmed.has(path)) return;
  const loader = ROUTE_CHUNK_LOADERS[path];
  if (!loader) return;
  warmed.add(path);
  void loader().catch(() => {
    warmed.delete(path);
  });
}

export function scheduleIdleRoutePreload(paths: readonly string[]): () => void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
    return () => undefined;
  }
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    for (const path of paths) {
      preloadRouteChunk(path);
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(run, { timeout: 1500 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleId);
    };
  }
  const timerId = window.setTimeout(run, 350);
  return () => {
    cancelled = true;
    window.clearTimeout(timerId);
  };
}
