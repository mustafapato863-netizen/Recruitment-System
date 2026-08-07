import { Controller, Get, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ReportsService } from './reports.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('kpis')
  @RequirePermissions('APPLICATION_VIEW')
  async getKpis(@CurrentUser() user: AuthUser) {
    return this.reportsService.getKpis(user.organizationId);
  }

  @Get('funnel')
  @RequirePermissions('APPLICATION_VIEW')
  async getFunnel(@CurrentUser() user: AuthUser) {
    return this.reportsService.getFunnel(user.organizationId);
  }

  @Get('hiring-by-department')
  @RequirePermissions('APPLICATION_VIEW')
  async getHiringByDepartment(@CurrentUser() user: AuthUser) {
    return this.reportsService.getHiringByDepartment(user.organizationId);
  }

  @Get('recruiter-workload')
  @RequirePermissions('APPLICATION_VIEW')
  async getRecruiterWorkload(@CurrentUser() user: AuthUser) {
    return this.reportsService.getRecruiterWorkload(user.organizationId);
  }
}
