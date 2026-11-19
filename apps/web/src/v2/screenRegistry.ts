/**
 * Every application route declared in App.tsx, grouped by actual surface.
 * "v2" means native V2 UI exists; it does NOT mean business UAT passed.
 * "retained" means legacy component/UX remains, including classic URLs that
 * the seat router currently redirects. "public" isn't in the signed-in shell.
 * Do not mark legacy work as fully migrated just because it uses V2 CSS.
 *
 * Guarded by src/v2/__tests__/route-coverage.test.ts to prevent missing routes.
 */
export type ScreenSurface = 'public' | 'v2' | 'retained' | 'redirect';
export interface ScreenRouteGroup {
  area: string;
  surface: ScreenSurface;
  paths: readonly string[];
}

export const SCREEN_ROUTE_GROUPS: readonly ScreenRouteGroup[] = [
  { area: "Public, authentication and candidate entry", surface: 'public', paths: [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/accept-invitation',
    '/verify-email',
    '/schedule/:token',
    '/portal',
    '/portal/applications/:token',
    '/my-applications',
    '/careers/:organizationCode/jobs',
    '/careers/:organizationCode/jobs/:vacancyCode/apply',
    '/careers/:organizationCode/jobs/:vacancyCode',
  ] },
  { area: "Core recruitment workflows", surface: 'v2', paths: [
    '/my-work',
    '/my-result',
    '/search',
    '/applications/:id',
    '/offers/:id',
    '/reports',
    '/hires/approvals/inbox',
    '/hires',
    '/offers',
    '/joinings',
    '/licenses',
    '/interviews',
    '/interviews/calendar',
  ] },
  { area: "Recruiter desk", surface: 'v2', paths: [
    '/vacancies',
    '/vacancies/:id',
    '/candidates',
    '/candidates/compare',
  ] },
  { area: "Manager desk", surface: 'v2', paths: [
    '/vacancy-requests',
    '/approvals',
    '/team-interviews',
  ] },
  { area: "Administration", surface: 'v2', paths: [
    '/users',
    '/roles',
    '/master-data',
    '/audit-log',
    '/pipeline-settings',
    '/whatsapp-templates',
    '/integrations',
  ] },
  { area: "Functional legacy views needing full native migration", surface: 'retained', paths: [
    '/my-interviews',
    '/profile',
    '/notifications',
    '/hires/:id',
    '/vacancies/:id/analytics',
    '/candidates/:id',
    '/candidates/:id/documents',
    '/cv-bank',
    '/sourcing-match',
    '/import',
    '/import/:dataset/:jobId',
    '/classic/candidates',
    '/classic/vacancies',
    '/settings/targets',
    '/access-control',
    '/classic/master-data',
    '/settings',
    '/classic/pipeline-settings',
  ] },
  { area: "Legacy aliases and catch-all", surface: 'redirect', paths: [
    '/talent-pools',
    '/talent-pools/:id',
    '/email-templates',
    '/joining',
    '/talent-pool',
    '*',
  ] },
];

export const SCREEN_ROUTES = SCREEN_ROUTE_GROUPS.flatMap((group) =>
  group.paths.map((path) => ({ path, area: group.area, surface: group.surface })),
);
