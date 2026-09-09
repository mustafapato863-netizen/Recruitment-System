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
