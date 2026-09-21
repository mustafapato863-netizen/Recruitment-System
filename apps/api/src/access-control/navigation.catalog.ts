import { NAVIGATION_CATALOG as SHARED_NAVIGATION_CATALOG } from '@recruitflow/contracts';
import type { NavigationItemRecord } from '@recruitflow/contracts';

/**
 * The route catalogue is code-owned (shared with the web app via @recruitflow/contracts);
 * labels and visibility are organization settings persisted by the administrator.
 * Access permissions remain enforced independently by the route guards and API decorators.
 */
export const NAVIGATION_CATALOG: NavigationItemRecord[] = SHARED_NAVIGATION_CATALOG.map((item) => ({
  ...item,
  requiredAnyPermissions: item.requiredAnyPermissions
    ? [...item.requiredAnyPermissions]
    : undefined,
}));
