import { Controller, Get, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ResultsService } from './results.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const uuid = new ParseUUIDPipe({ optional: true });

/** B8: four monthly numbers. me = anyone; team = managers (direct reports); org = admins. */
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser, @Query('month') month?: string, @Query('vacancyId', uuid) vacancyId?: string) {
    return this.results.results(user, 'me', { ...(month ? { month } : {}), ...(vacancyId ? { vacancyId } : {}) });
  }

  @Get('team')
  team(@CurrentUser() user: AuthUser, @Query('month') month?: string, @Query('vacancyId', uuid) vacancyId?: string, @Query('managerId', uuid) managerId?: string) {
    return this.results.results(user, 'team', { ...(month ? { month } : {}), ...(vacancyId ? { vacancyId } : {}), ...(managerId ? { managerId } : {}) });
  }

  @Get('org')
  org(@CurrentUser() user: AuthUser, @Query('month') month?: string, @Query('vacancyId', uuid) vacancyId?: string, @Query('managerId', uuid) managerId?: string) {
    return this.results.results(user, 'org', { ...(month ? { month } : {}), ...(vacancyId ? { vacancyId } : {}), ...(managerId ? { managerId } : {}) });
  }
}
