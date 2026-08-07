import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PipelineSettingsService } from './pipeline-settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { CreatePipelineTemplateDto, CreatePipelineStageDto, UpdatePipelineStageDto, ReorderStagesDto } from './pipeline-settings.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
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
  async getTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getTemplate(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_TEMPLATE_CREATE')
  async createTemplate(@CurrentUser() user: AuthUser, @Body() dto: CreatePipelineTemplateDto) {
    return this.service.createTemplate(user.organizationId, dto);
  }

  @Post(':id/duplicate')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_TEMPLATE_DUPLICATE')
  async duplicateTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.duplicateTemplate(user.organizationId, id);
  }

  @Post(':id/stages')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_CREATE')
  async addStage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreatePipelineStageDto) {
    return this.service.addStage(user.organizationId, id, dto);
  }

  @Patch(':id/stages/reorder')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_REORDER')
  async reorderStages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReorderStagesDto) {
    return this.service.reorderStages(user.organizationId, id, dto);
  }

  @Patch(':id/stages/:stageId')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_UPDATE')
  async updateStage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdatePipelineStageDto
  ) {
    return this.service.updateStage(user.organizationId, id, stageId, dto);
  }

  @Delete(':id/stages/:stageId')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('PIPELINE_STAGE_DELETE')
  async deleteStage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string
  ) {
    return this.service.deleteStage(user.organizationId, id, stageId);
  }
}
