import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationStageDto,
  ApplicationQueryDto,
} from './applications.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
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
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'id' })
  getApplication(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.getApplication(user.organizationId, id);
  }

  @Get(':id/history')
  @RequirePermissions('APPLICATION_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'id' })
  getApplicationHistory(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
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
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'application', param: 'id' })
  updateStage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
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
