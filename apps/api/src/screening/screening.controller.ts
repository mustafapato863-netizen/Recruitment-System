import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ScreeningService } from './screening.service';
import { CreateScreeningLogDto, UpsertScreeningDraftDto } from './screening.dto';
import { UserPermissionsService } from '../common/user-permissions.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { canSeeCurrentSalary } from '../common/access/pay-visibility';
import type { Response } from 'express';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('screening')
export class ScreeningController {
  constructor(
    private readonly screeningService: ScreeningService,
    private readonly userPermissions: UserPermissionsService,
  ) {}

  @Get('application/:applicationId')
  @RequirePermissions('APPLICATION_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'applicationId' })
  async listScreeningLogs(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.screeningService.listScreeningLogs(
      user.organizationId,
      applicationId,
      { viewSalary: await canSeeCurrentSalary(this.userPermissions, user) },
      user,
    );
  }

  @Get('application/:applicationId/draft')
  @RequirePermissions('APPLICATION_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'applicationId' })
  async getScreeningDraft(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const draft = await this.screeningService.getScreeningDraft(
      user.organizationId,
      user.userId,
      applicationId,
      user,
    );
    // Nest drops a null return. Send JSON null so a missing draft stays null.
    res.status(HttpStatus.OK).json(draft ?? null);
  }

  @Put('application/:applicationId/draft')
  @RequirePermissions('CANDIDATE_EDIT')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'applicationId' })
  upsertScreeningDraft(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() body: UpsertScreeningDraftDto,
  ) {
    return this.screeningService.upsertScreeningDraft(
      user.organizationId,
      user.userId,
      applicationId,
      body,
      user,
    );
  }

  @Delete('application/:applicationId/draft')
  @RequirePermissions('CANDIDATE_EDIT')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'applicationId' })
  deleteScreeningDraft(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.screeningService.deleteScreeningDraft(
      user.organizationId,
      user.userId,
      applicationId,
      user,
    );
  }

  @Post()
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('SCREENING_SUBMIT')
  async createScreeningLog(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateScreeningLogDto,
  ) {
    return this.screeningService.createScreeningLog(
      user.organizationId,
      user.userId,
      body,
      { viewSalary: await canSeeCurrentSalary(this.userPermissions, user) },
      user,
    );
  }
}
