import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AuditService } from './audit.service';
import type { AuditSearchQuery } from './audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('AUDIT_VIEW')
  query(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.auditService.query(user.organizationId, pageNum, sizeNum);
  }
}

/** C5: GET /audit — admin-only search with server-side filters and pagination. /audit-logs stays for v1. */
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditSearchController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('AUDIT_VIEW')
  search(@CurrentUser() user: AuthUser, @Query() q: AuditSearchQuery) {
    if (!user.roleCodes.includes('ADMINISTRATOR')) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an administrator can search the audit log.' });
    return this.auditService.search(user.organizationId, q ?? {});
  }
}
