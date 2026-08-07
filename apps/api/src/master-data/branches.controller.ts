import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MasterDataService } from './master-data.service';
import { CreateBranchDto } from './master-data.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('BRANCH_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBranchDto) {
    return this.masterDataService.createBranch(user.organizationId, body);
  }
}
