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
import { CandidatesService } from './candidates.service';
import {
  CreateCandidateDto,
  UpdateCandidateDto,
  CandidateQueryDto,
} from './candidates.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @RequirePermissions('CANDIDATE_VIEW')
  listCandidates(
    @CurrentUser() user: AuthUser,
    @Query() query: CandidateQueryDto,
  ) {
    return this.candidatesService.listCandidates(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('CANDIDATE_VIEW')
  getCandidate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.candidatesService.getCandidate(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('CANDIDATE_CREATE')
  @AuditAction('CANDIDATE_CREATE')
  createCandidate(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateCandidateDto,
  ) {
    return this.candidatesService.createCandidate(user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_UPDATE')
  updateCandidate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCandidateDto,
  ) {
    return this.candidatesService.updateCandidate(user.organizationId, id, body);
  }
}
