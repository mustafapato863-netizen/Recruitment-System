import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { InterviewsService } from './interviews.service';
import {
  CreateInterviewDto,
  UpdateInterviewDto,
  SubmitScorecardDto,
  InterviewQueryDto,
} from './interviews.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  @RequirePermissions('VACANCY_VIEW')
  listInterviews(
    @CurrentUser() user: AuthUser,
    @Query() query: InterviewQueryDto,
  ) {
    return this.interviewsService.listInterviews(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('VACANCY_VIEW')
  getInterview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.interviewsService.getInterview(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('INTERVIEW_SCHEDULE')
  createInterview(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateInterviewDto,
  ) {
    return this.interviewsService.createInterview(user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('INTERVIEW_UPDATE')
  updateInterview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateInterviewDto,
  ) {
    return this.interviewsService.updateInterview(user.organizationId, id, body);
  }

  @Post(':id/scorecard')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('SCORECARD_SUBMIT')
  submitScorecard(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: SubmitScorecardDto,
  ) {
    return this.interviewsService.submitScorecard(
      user.organizationId,
      id,
      user.userId,
      body,
    );
  }
}
