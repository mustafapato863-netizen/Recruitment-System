import { Controller, Get, Header } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AccessExportService } from './access-export.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AuthUser } from '@recruitflow/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { accessExportToCsv } from './access-export.builder';

/**
 * Roadmap v2 step 0a: admin-only export of roles, users and grants.
 * Requires both ROLES_MANAGE and USERS_MANAGE (admin-level; the seeded
 * Administrator passes through PermissionsGuard). Everyone else gets 403.
 */
export const ACCESS_EXPORT_PERMISSIONS = ['ROLES_MANAGE', 'USERS_MANAGE'] as const;

@Controller('admin/access-export')
export class AccessExportController {
  constructor(private readonly accessExportService: AccessExportService) {}

  @Get()
  @RequirePermissions(...ACCESS_EXPORT_PERMISSIONS)
  @AuditAction('ACCESS_EXPORT_JSON')
  exportJson(@CurrentUser() user: AuthUser) {
    return this.accessExportService.exportForOrganization(user.organizationId);
  }

  @Get('csv')
  @RequirePermissions(...ACCESS_EXPORT_PERMISSIONS)
  @AuditAction('ACCESS_EXPORT_CSV')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="roles-users-grants.csv"')
  async exportCsv(@CurrentUser() user: AuthUser): Promise<string> {
    return accessExportToCsv(await this.accessExportService.exportForOrganization(user.organizationId));
  }
}
