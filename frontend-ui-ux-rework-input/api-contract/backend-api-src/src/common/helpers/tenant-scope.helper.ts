

/**
 * Merges the tenant (organizationId) into a Prisma where clause.
 * If the provided where already contains an organizationId, it will be overwritten to ensure tenant isolation.
 */
export function applyTenantScope<T extends { organizationId?: string }>(
  where: T,
  tenantId: string,
): T {
  return { ...where, organizationId: tenantId } as T;
}
