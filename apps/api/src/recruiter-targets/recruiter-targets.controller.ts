import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { RecruiterTargetsService } from './recruiter-targets.service';
import { UpsertRecruiterTargetDto, UpdateRecruiterTargetDto } from './recruiter-targets.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('recruiter-targets')
export class RecruiterTargetsController {
  constructor(private readonly service: RecruiterTargetsService) {}

  /** GET /recruiter-targets — List all targets (Team Lead / Manager view) */
  @Get()
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_ASSIGN')
  list(
    @CurrentUser() user: AuthUser,
    @Query('period') period?: string,
  ) {
    return this.service.list(user.organizationId, period);
  }

  /** GET /recruiter-targets/my — Get current user's own targets + live progress */
  @Get('my')
  @RequirePermissions('TASK_VIEW')
  getMyProgress(@CurrentUser() user: AuthUser) {
    return this.service.getMyProgress(user.organizationId, user.userId);
  }

  /** POST /recruiter-targets — Create or update a recruiter's target */
  @Post()
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_ASSIGN')
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertRecruiterTargetDto,
  ) {
    return this.service.upsert(user.organizationId, user.userId, dto);
  }

  /** PATCH /recruiter-targets/:id — Update existing target */
  @Patch(':id')
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_ASSIGN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecruiterTargetDto,
  ) {
    return this.service.update(user.organizationId, id, dto);
  }

  /** DELETE /recruiter-targets/:id — Deactivate a target */
  @Delete(':id')
  @RequireAnyPermissions('VACANCY_MANAGE')
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deactivate(user.organizationId, id);
  }
}
