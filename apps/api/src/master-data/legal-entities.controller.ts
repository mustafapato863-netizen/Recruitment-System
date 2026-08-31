import { Controller, Get, Post, Delete, Param, ParseUUIDPipe, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MasterDataService } from './master-data.service';
import { CreateLegalEntityDto } from './master-data.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('legal-entities')
export class LegalEntitiesController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.masterDataService.listLegalEntities(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('MASTER_DATA_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'legalEntity', param: 'id' })
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.getLegalEntity(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('LEGAL_ENTITY_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateLegalEntityDto) {
    return this.masterDataService.createLegalEntity(user.organizationId, body);
  }

  @Post(':id/archive')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'legalEntity', param: 'id' })
  @AuditAction('LEGAL_ENTITY_ARCHIVE')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.archiveLegalEntity(user.organizationId, id);
  }

  @Post(':id/restore')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'legalEntity', param: 'id' })
  @AuditAction('LEGAL_ENTITY_RESTORE')
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.restoreLegalEntity(user.organizationId, id);
  }

  @Delete(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'legalEntity', param: 'id' })
  @AuditAction('LEGAL_ENTITY_DELETE')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteLegalEntity(user.organizationId, id);
  }
}
