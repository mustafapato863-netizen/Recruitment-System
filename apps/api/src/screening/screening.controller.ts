import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ScreeningService } from './screening.service';
import { CreateScreeningLogDto } from './screening.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('screening')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Get('application/:applicationId')
  @RequirePermissions('APPLICATION_VIEW')
  listScreeningLogs(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.screeningService.listScreeningLogs(user.organizationId, applicationId);
  }

  @Post()
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('SCREENING_SUBMIT')
  createScreeningLog(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateScreeningLogDto,
  ) {
    return this.screeningService.createScreeningLog(
      user.organizationId,
      user.userId,
      body,
    );
  }
}
