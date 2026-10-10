import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { InterviewsService } from './interviews.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MY_INTERVIEW_SCOPES } from '@recruitflow/contracts';
import type { AuthUser, MyInterviewScope, MyInterviewsResponse } from '@recruitflow/contracts';

/**
 * B1 follow-up (QA BUG-4): the interviewer's entry point, shaped to the #7
 * frontend contract. Sign-in only: it returns just the caller's own attended
 * interviews, so no permission or file guard applies.
 */
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeInterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get('interviews')
  listMyInterviews(@CurrentUser() user: AuthUser, @Query('scope') scope?: string): Promise<MyInterviewsResponse> {
    return this.interviewsService.listMyInterviews(user.organizationId, user.userId, parseScope(scope));
  }
}

export function parseScope(scope: unknown): MyInterviewScope {
  if (scope === undefined || scope === '') return 'upcoming';
  if (typeof scope === 'string' && (MY_INTERVIEW_SCOPES as readonly string[]).includes(scope)) return scope as MyInterviewScope;
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Please correct the highlighted fields.',
    fields: { scope: ['scope must be one of: upcoming, past.'] },
  });
}
