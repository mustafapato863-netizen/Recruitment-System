import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Require at least one of the supplied permissions. This is useful for a
 * capability that can be granted through a broad legacy permission or one of
 * several focused permissions, while keeping RequirePermissions' all-of
 * semantics unchanged for existing routes.
 */
export const ANY_PERMISSIONS_KEY = 'anyPermissions';
export const RequireAnyPermissions = (...permissions: string[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions);

/**
 * Admin-only route: the caller must hold the ADMINISTRATOR role. Enforced by
 * PermissionsGuard on top of any permission metadata. Used for template
 * management (create/edit/duplicate/archive), which Mustafa limited to admins.
 */
export const ADMIN_ONLY_KEY = 'adminOnly';
export const RequireAdmin = () => SetMetadata(ADMIN_ONLY_KEY, true);
