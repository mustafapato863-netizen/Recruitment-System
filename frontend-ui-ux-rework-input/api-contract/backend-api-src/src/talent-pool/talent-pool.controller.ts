import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe, ParseUUIDPipe } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { TalentPoolService } from './talent-pool.service';
import { CreateTalentPoolDto, AddToPoolDto } from './talent-pool.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('talent-pools')
export class TalentPoolController {
  constructor(private readonly talentPoolService: TalentPoolService) {}

  @Get()
  @RequirePermissions('CANDIDATE_VIEW')
  async getPools(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
  ) {
    return this.talentPoolService.getPools(user.organizationId, search, page, pageSize);
  }

  @Post()
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('TALENT_POOL_CREATE')
  async createPool(@CurrentUser() user: AuthUser, @Body() dto: CreateTalentPoolDto) {
    return this.talentPoolService.createPool(user.organizationId, dto);
  }

  @Get('recently-added')
  @RequirePermissions('CANDIDATE_VIEW')
  async getRecentlyAdded(@CurrentUser() user: AuthUser) {
    return this.talentPoolService.getRecentlyAdded(user.organizationId);
  }

  @Get('health')
  @RequirePermissions('CANDIDATE_VIEW')
  async getHealthMetrics(@CurrentUser() user: AuthUser) {
    return this.talentPoolService.getHealthMetrics(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('CANDIDATE_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'talentPool', param: 'id' })
  async getPoolDetail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
  ) {
    return this.talentPoolService.getPoolDetail(user.organizationId, id, page, pageSize);
  }

  @Post(':id/candidates')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('TALENT_POOL_CANDIDATE_ADD')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'talentPool', param: 'id' })
  async addCandidate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddToPoolDto,
  ) {
    return this.talentPoolService.addCandidate(user.organizationId, id, dto);
  }

  @Delete(':id/candidates/:candidateId')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('TALENT_POOL_CANDIDATE_REMOVE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'talentPool', param: 'id' })
  async removeCandidate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
  ) {
    return this.talentPoolService.removeCandidate(user.organizationId, id, candidateId);
  }
}
