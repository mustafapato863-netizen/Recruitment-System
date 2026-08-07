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
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationStageDto,
  ApplicationQueryDto,
} from './applications.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @RequirePermissions('APPLICATION_VIEW')
  listApplications(
    @CurrentUser() user: AuthUser,
    @Query() query: ApplicationQueryDto,
  ) {
    return this.applicationsService.listApplications(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('APPLICATION_VIEW')
  getApplication(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applicationsService.getApplication(user.organizationId, id);
  }

  @Get(':id/history')
  @RequirePermissions('APPLICATION_VIEW')
  getApplicationHistory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.applicationsService.getApplicationHistory(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('APPLICATION_CREATE')
  @AuditAction('APPLICATION_CREATE')
  createApplication(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateApplicationDto,
  ) {
    return this.applicationsService.createApplication(user.organizationId, body);
  }

  @Patch(':id/stage')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('APPLICATION_STAGE_CHANGE')
  updateStage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateApplicationStageDto,
  ) {
    return this.applicationsService.updateStage(
      user.organizationId,
      id,
      user.userId,
      body,
    );
  }
}
