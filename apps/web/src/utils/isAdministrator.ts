import type { UserProfile } from '@recruitflow/contracts';

/** NEW-4: administrators oversee work and cannot claim it, so they are never offered "Assign to me". */
export function isAdministratorUser(user?: Pick<UserProfile, 'roles'> | null): boolean {
  return Boolean(
    user?.roles?.some((r) => ['ADMINISTRATOR', 'SYSADMINISTRATOR', 'ADMIN'].includes(r.code) || r.name?.toLowerCase() === 'administrator'),
  );
}
