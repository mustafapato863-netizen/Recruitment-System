import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
// Runtime service and DTO imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MatchingService } from './matching.service';
import { AddSkillEvidenceDto, DuplicateCheckDto } from './matching.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/** B6: suggest and compare on a job (with skill evidence), candidate skill evidence, duplicate check. */
@UseGuards(JwtAuthGuard)
@Controller()
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get('vacancies/:id/suggestions')
  @RequirePermissions('VACANCY_VIEW')
  suggestions(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.suggestions(user, id);
  }

  @Get('vacancies/:id/compare')
  @RequirePermissions('VACANCY_VIEW')
  compare(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('candidateIds') candidateIds?: string) {
    return this.matching.compare(user, id, (candidateIds ?? '').split(','));
  }

  @Post('candidates/duplicate-check')
  @RequirePermissions('CANDIDATE_VIEW')
  duplicateCheck(@CurrentUser() user: AuthUser, @Body() body: DuplicateCheckDto) {
    return this.matching.duplicateCheck(user.organizationId, body);
  }

  @Get('candidates/:id/skills')
  @RequirePermissions('CANDIDATE_VIEW')
  listSkills(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.listCandidateSkills(user.organizationId, id);
  }

  @Post('candidates/:id/skills/evidence')
  @RequirePermissions('CANDIDATE_EDIT')
  addEvidence(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AddSkillEvidenceDto) {
    return this.matching.addEvidence(user.organizationId, id, body, user.userId);
  }

  @Post('candidates/:id/skills/derive-evidence')
  @RequirePermissions('CANDIDATE_EDIT')
  derive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.deriveEvidence(user.organizationId, id, user.userId);
  }
}
