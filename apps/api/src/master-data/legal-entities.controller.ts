import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MasterDataService } from './master-data.service';
import { CreateLegalEntityDto } from './master-data.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('LEGAL_ENTITY_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateLegalEntityDto) {
    return this.masterDataService.createLegalEntity(user.organizationId, body);
  }
}
