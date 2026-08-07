import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MasterDataService } from './master-data.service';
import { CreatePositionDto } from './master-data.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('positions')
export class PositionsController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.masterDataService.listPositions(user.organizationId);
  }

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('POSITION_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePositionDto) {
    return this.masterDataService.createPosition(user.organizationId, body);
  }
}
