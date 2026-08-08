import { Controller, Post, Get, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ImportService } from './import.service';
import { UploadImportDto, SaveDecisionDto } from './import.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('candidates/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('jobs')
  @RequirePermissions('CANDIDATE_VIEW')
  async listJobs(
    @CurrentUser() user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number = 20,
  ) {
    return this.importService.listJobs(user.organizationId, page, pageSize);
  }

  @Post('upload')
  @RequirePermissions('CANDIDATE_CREATE')
  @AuditAction('CANDIDATE_IMPORT_UPLOAD')
  async upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadImportDto,
  ) {
    return this.importService.upload(user.organizationId, user.userId, dto);
  }

  @Get(':jobId')
  @RequirePermissions('CANDIDATE_VIEW')
  async getJobSummary(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.importService.getJobSummary(user.organizationId, jobId);
  }

  @Get(':jobId/rows')
  @RequirePermissions('CANDIDATE_VIEW')
  async getJobRows(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
    @Query('result') result?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number = 20,
  ) {
    return this.importService.getJobRows(user.organizationId, jobId, result, page, pageSize);
  }

  @Post(':jobId/rows/:rowId/decision')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_IMPORT_DECISION')
  async saveDecision(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
    @Param('rowId') rowId: string,
    @Body() dto: SaveDecisionDto,
  ) {
    return this.importService.saveDecision(user.organizationId, jobId, rowId, dto);
  }

  @Post(':jobId/confirm')
  @RequirePermissions('CANDIDATE_CREATE')
  @AuditAction('CANDIDATE_IMPORT_CONFIRM')
  async confirmJob(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.importService.confirmJob(user.organizationId, jobId);
  }

  @Get(':jobId/error-report')
  @RequirePermissions('CANDIDATE_VIEW')
  async getErrorReport(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.importService.getErrorReport(user.organizationId, jobId);
  }
}
