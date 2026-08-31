import { Controller, Get, Post, Patch, Delete, Param, ParseUUIDPipe, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PipelineSettingsService } from './pipeline-settings.service';
import { CreatePipelineTemplateDto, UpdatePipelineTemplateDto, CreatePipelineStageDto, UpdatePipelineStageDto, ReorderStagesDto } from './pipeline-settings.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@Controller('pipeline-templates')
@UseGuards(JwtAuthGuard)
export class PipelineSettingsController {
  constructor(private readonly service: PipelineSettingsService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  async listTemplates(@CurrentUser() user: AuthUser) {
    return this.service.listTemplates(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('MASTER_DATA_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async getTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTemplate(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_TEMPLATE_CREATE')
  async createTemplate(@CurrentUser() user: AuthUser, @Body() dto: CreatePipelineTemplateDto) {
    return this.service.createTemplate(user.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_TEMPLATE_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async updateTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePipelineTemplateDto) {
    return this.service.updateTemplate(user.organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_TEMPLATE_ARCHIVE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async archiveTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archiveTemplate(user.organizationId, id);
  }

  @Post(':id/duplicate')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_TEMPLATE_DUPLICATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async duplicateTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.duplicateTemplate(user.organizationId, id);
  }

  @Post(':id/stages')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_CREATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async addStage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePipelineStageDto) {
    return this.service.addStage(user.organizationId, id, dto);
  }

  @Patch(':id/stages/reorder')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_REORDER')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async reorderStages(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderStagesDto) {
    return this.service.reorderStages(user.organizationId, id, dto);
  }

  @Patch(':id/stages/:stageId')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async updateStage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: UpdatePipelineStageDto
  ) {
    return this.service.updateStage(user.organizationId, id, stageId, dto);
  }

  @Delete(':id/stages/:stageId')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_DELETE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'pipelineTemplate', param: 'id' })
  async deleteStage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string
  ) {
    return this.service.deleteStage(user.organizationId, id, stageId);
  }
}
