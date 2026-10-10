import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { AuthUser } from '@recruitflow/contracts';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { GradeBandsService } from './grade-bands.service';
import { OfferDecisionService } from './offer-decision.service';
import { ReassignService } from './reassign.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

export class GradeBandDto {
  @IsOptional() @IsUUID() gradeId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsNumber() minMonthlyBase?: number;
  @IsOptional() @IsNumber() maxMonthlyBase?: number;
  @IsOptional() @IsIn(['Active', 'Inactive']) status?: 'Active' | 'Inactive';
}
export class ManagerDecisionDto {
  @IsIn(['Approve', 'Reject', 'RequestChanges']) decision!: 'Approve' | 'Reject' | 'RequestChanges';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class ReassignFilesDto {
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) applicationIds?: string[];
  @IsOptional() @IsUUID() fromUserId?: string;
  @IsUUID() toUserId!: string;
  @IsString() @MaxLength(1000) reason!: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class ManagerDecisionController {
  constructor(
    private readonly bands: GradeBandsService,
    private readonly decisions: OfferDecisionService,
    private readonly reassignments: ReassignService,
  ) {}

  @Get('master-data/grade-bands')
  @RequirePermissions('MASTER_DATA_VIEW')
  listBands(@CurrentUser() user: AuthUser, @Query('includeInactive') includeInactive?: string) {
    return this.bands.list(user, includeInactive === 'true');
  }

  @Post('master-data/grade-bands')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('GRADE_BAND_CREATE')
  createBand(@CurrentUser() user: AuthUser, @Body() dto: GradeBandDto) {
    return this.bands.create(user, dto);
  }

  @Patch('master-data/grade-bands/:id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('GRADE_BAND_UPDATE')
  updateBand(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GradeBandDto) {
    return this.bands.update(user, id, dto);
  }

  /** No delete: deactivates. */
  @Delete('master-data/grade-bands/:id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('GRADE_BAND_DEACTIVATE')
  deactivateBand(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bands.deactivate(user, id);
  }

  @Post('offers/:id/versions/:versionId/decision')
  @RequirePermissions('APPLICATION_VIEW')
  decide(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @Body() dto: ManagerDecisionDto) {
    return this.decisions.decide(user, id, versionId, dto);
  }

  @Post('files/reassign')
  @RequirePermissions('APPLICATION_VIEW')
  reassign(@CurrentUser() user: AuthUser, @Body() dto: ReassignFilesDto) {
    return this.reassignments.reassign(user, dto);
  }
}
