import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { InterviewsService } from './interviews.service';
import { SelfScheduleService } from './self-schedule.service';
import {
  CreateInterviewDto,
  UpdateInterviewDto,
  SubmitScorecardDto,
  InterviewQueryDto,
  CheckAvailabilityDto,
  GenerateSelfScheduleDto,
  UpdateInterviewResponseDto,
} from './interviews.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly selfScheduleService: SelfScheduleService,
  ) {}

  @Get()
  @RequirePermissions('VACANCY_VIEW')
  listInterviews(
    @CurrentUser() user: AuthUser,
    @Query() query: InterviewQueryDto,
  ) {
    return this.interviewsService.listInterviews(user.organizationId, query, user);
  }

  @Post('availability')
  @RequirePermissions('VACANCY_VIEW')
  checkAvailability(
    @CurrentUser() user: AuthUser,
    @Body() body: CheckAvailabilityDto,
  ) {
    return this.interviewsService.getAvailability(
      user.organizationId,
      body.attendeeUserIds,
      body.scheduledStart,
      body.scheduledEnd,
      body.excludeInterviewId,
    );
  }

  @Post('self-schedule-link')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('INTERVIEW_GENERATE_SELF_SCHEDULE')
  generateSelfScheduleLink(
    @CurrentUser() user: AuthUser,
    @Body() body: GenerateSelfScheduleDto,
  ) {
    return this.selfScheduleService.createInvitationLink(user.organizationId, body);
  }

  @Get(':id')
  @RequirePermissions('VACANCY_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'interview', param: 'id' })
  getInterview(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviewsService.getInterview(user.organizationId, id, user);
  }

  @Get(':id/ics')
  @RequirePermissions('VACANCY_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'interview', param: 'id' })
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="interview.ics"')
  getInterviewIcs(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviewsService.getInterviewIcs(user.organizationId, id, user);
  }

  @Post()
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('INTERVIEW_SCHEDULE')
  createInterview(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateInterviewDto,
  ) {
    return this.interviewsService.createInterview(user.organizationId, body, user);
  }

  @Patch(':id')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('INTERVIEW_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'interview', param: 'id' })
  updateInterview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInterviewDto,
  ) {
    return this.interviewsService.updateInterview(user.organizationId, id, body, user);
  }

  @Post(':id/response')
  @RequirePermissions('VACANCY_VIEW')
  @AuditAction('INTERVIEW_RESPONSE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'interview', param: 'id' })
  respondToInterview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInterviewResponseDto,
  ) {
    return this.interviewsService.respondToInterview(user.organizationId, id, user.userId, body, user);
  }

  @Post(':id/scorecard')
  @RequirePermissions('VACANCY_VIEW')
  @AuditAction('SCORECARD_SUBMIT')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'interview', param: 'id' })
  submitScorecard(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitScorecardDto,
  ) {
    return this.interviewsService.submitScorecard(
      user.organizationId,
      id,
      user.userId,
      body,
      user,
    );
  }
}
