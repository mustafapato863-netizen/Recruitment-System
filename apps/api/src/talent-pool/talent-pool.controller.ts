import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { TalentPoolService } from './talent-pool.service';
import { CreateTalentPoolDto, AddToPoolDto } from './talent-pool.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  async getPools(@CurrentUser() user: AuthUser) {
    return this.talentPoolService.getPools(user.organizationId);
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
  async getPoolDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.talentPoolService.getPoolDetail(user.organizationId, id, page, pageSize);
  }

  @Post(':id/candidates')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('TALENT_POOL_CANDIDATE_ADD')
  async addCandidate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddToPoolDto,
  ) {
    return this.talentPoolService.addCandidate(user.organizationId, id, dto);
  }

  @Delete(':id/candidates/:candidateId')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('TALENT_POOL_CANDIDATE_REMOVE')
  async removeCandidate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
  ) {
    return this.talentPoolService.removeCandidate(user.organizationId, id, candidateId);
  }
}
