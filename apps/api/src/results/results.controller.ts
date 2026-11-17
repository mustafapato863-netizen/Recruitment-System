import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ResultsService, type CreateTargetInput, type UpdateTargetInput, type MonthlyPlanInput } from './results.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

const uuid = new ParseUUIDPipe({ optional: true });

/** B8: monthly results; team also accepts real weekly periods. me = anyone; team = direct reports; org = admins. */
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser, @Query('month') month?: string, @Query('vacancyId', uuid) vacancyId?: string) {
    return this.results.results(user, 'me', { ...(month ? { month } : {}), ...(vacancyId ? { vacancyId } : {}) });
  }

  @Get('team')
  team(@CurrentUser() user: AuthUser, @Query('month') month?: string, @Query('vacancyId', uuid) vacancyId?: string, @Query('managerId', uuid) managerId?: string, @Query('branchId', uuid) branchId?: string, @Query('periodType') periodType?: string, @Query('periodKey') periodKey?: string) {
    return this.results.results(user, 'team', { ...(month ? { month } : {}), ...(vacancyId ? { vacancyId } : {}), ...(managerId ? { managerId } : {}), ...(branchId ? { branchId } : {}), ...(periodType !== undefined ? { periodType } : {}), ...(periodKey !== undefined ? { periodKey } : {}) });
  }

  @Get('org')
  org(@CurrentUser() user: AuthUser, @Query('month') month?: string, @Query('vacancyId', uuid) vacancyId?: string, @Query('managerId', uuid) managerId?: string) {
    return this.results.results(user, 'org', { ...(month ? { month } : {}), ...(vacancyId ? { vacancyId } : {}), ...(managerId ? { managerId } : {}) });
  }

  @Get('targets')
  @RequirePermissions('APPLICATION_VIEW')
  listTargets(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: 'me' | 'team' | 'org',
    @Query('periodType') periodType?: 'weekly' | 'monthly',
    @Query('periodKey') periodKey?: string,
    @Query('vacancyId', uuid) vacancyId?: string,
    @Query('branchId', uuid) branchId?: string,
    @Query('employeeId', uuid) employeeId?: string,
  ) {
    return this.results.listTargets(user, {
      ...(scope ? { scope } : {}),
      ...(periodType ? { periodType } : {}),
      ...(periodKey ? { periodKey } : {}),
      ...(vacancyId ? { vacancyId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(employeeId ? { employeeId } : {}),
    });
  }

  @Post('targets')
  @RequirePermissions('APPLICATION_VIEW')
  createTarget(@CurrentUser() user: AuthUser, @Body() body: CreateTargetInput) {
    return this.results.createTarget(user, body);
  }

  @Post('target-plans')
  @RequirePermissions('APPLICATION_VIEW')
  saveMonthlyPlan(@CurrentUser() user: AuthUser, @Body() body: MonthlyPlanInput) {
    return this.results.saveMonthlyPlan(user, body);
  }

  @Patch('targets/:id')
  @RequirePermissions('APPLICATION_VIEW')
  updateTarget(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateTargetInput) {
    return this.results.updateTarget(user, id, body);
  }

  @Get('targets/:id/records')
  @RequirePermissions('APPLICATION_VIEW')
  targetRecords(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.results.targetRecords(user, id);
  }
}
