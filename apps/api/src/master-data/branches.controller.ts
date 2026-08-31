import { Controller, Get, Post, Delete, Param, ParseUUIDPipe, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MasterDataService } from './master-data.service';
import { CreateBranchDto } from './master-data.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.masterDataService.listBranches(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('MASTER_DATA_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'branch', param: 'id' })
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.getBranch(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('BRANCH_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBranchDto) {
    return this.masterDataService.createBranch(user.organizationId, body);
  }

  @Post(':id/archive')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'branch', param: 'id' })
  @AuditAction('BRANCH_ARCHIVE')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.archiveBranch(user.organizationId, id);
  }

  @Post(':id/restore')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'branch', param: 'id' })
  @AuditAction('BRANCH_RESTORE')
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.restoreBranch(user.organizationId, id);
  }

  @Delete(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'branch', param: 'id' })
  @AuditAction('BRANCH_DELETE')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteBranch(user.organizationId, id);
  }
}
