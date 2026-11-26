import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ReportsService } from './reports.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
// Nest requires the DTO class at runtime for ValidationPipe decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReportOverviewQueryDto } from './reports.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @RequirePermissions('APPLICATION_VIEW')
  async getOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    return this.reportsService.getOverview(user.organizationId, query, user);
  }

  @Get('export.xlsx')
  @RequirePermissions('APPLICATION_VIEW')
  async exportExcel(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    const workbook = await this.reportsService.exportExcel(user.organizationId, query, user);
    return new StreamableFile(workbook, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="recruitflow-report.xlsx"',
    });
  }

  @Get('kpis')
  @RequirePermissions('APPLICATION_VIEW')
  async getKpis(@CurrentUser() user: AuthUser, @Query() query: ReportOverviewQueryDto) {
    return this.reportsService.getKpis(user.organizationId, user, query);
  }

  @Get('funnel')
  @RequirePermissions('APPLICATION_VIEW')
  async getFunnel(@CurrentUser() user: AuthUser, @Query() query: ReportOverviewQueryDto) {
    return this.reportsService.getFunnel(user.organizationId, user, query);
  }

  @Get('hiring-by-department')
  @RequirePermissions('APPLICATION_VIEW')
  async getHiringByDepartment(@CurrentUser() user: AuthUser, @Query() query: ReportOverviewQueryDto) {
    return this.reportsService.getHiringByDepartment(user.organizationId, user, query);
  }

  @Get('recruiter-workload')
  @RequirePermissions('APPLICATION_VIEW')
  async getRecruiterWorkload(@CurrentUser() user: AuthUser, @Query() query: ReportOverviewQueryDto) {
    return this.reportsService.getRecruiterWorkload(user.organizationId, user, query);
  }

  /** Meeting notes 2026-11-25 (item 5): per-entity (per-branch) report. */
  @Get('by-entity')
  @RequirePermissions('APPLICATION_VIEW')
  async getByEntity(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    return this.reportsService.getByEntity(user.organizationId, query, user);
  }

  /** Ticket 07: Vacancy Tracker report (open requests separate from remaining seats, no replaced employee column). */
  @Get('vacancy-tracker')
  @RequirePermissions('APPLICATION_VIEW')
  async getVacancyTracker(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    return this.reportsService.getVacancyTracker(user.organizationId, query, user);
  }

  @Get('vacancy-tracker/export.xlsx')
  @RequirePermissions('APPLICATION_VIEW')
  async exportVacancyTrackerExcel(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    const workbook = await this.reportsService.exportVacancyTrackerExcel(user.organizationId, query, user);
    return new StreamableFile(workbook, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="vacancy-tracker.xlsx"',
    });
  }

  /** Ticket 07: Candidate Activity report (application counted once per stage reached, with drill-down). */
  @Get('candidate-activity')
  @RequirePermissions('APPLICATION_VIEW')
  async getCandidateActivity(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    return this.reportsService.getCandidateActivity(user.organizationId, query, user);
  }

  @Get('candidate-activity/export.xlsx')
  @RequirePermissions('APPLICATION_VIEW')
  async exportCandidateActivityExcel(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportOverviewQueryDto,
  ) {
    const workbook = await this.reportsService.exportCandidateActivityExcel(user.organizationId, query, user);
    return new StreamableFile(workbook, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="candidate-activity.xlsx"',
    });
  }
}
