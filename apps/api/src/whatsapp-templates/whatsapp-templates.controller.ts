import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { WhatsAppTemplatesService } from './whatsapp-templates.service';
import {
  CreateWhatsAppTemplateDto,
  RenderWhatsAppTemplateDto,
  UpdateWhatsAppTemplateDto,
} from './whatsapp-templates.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequireAnyPermissions, RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@Controller('whatsapp-templates')
@UseGuards(JwtAuthGuard)
export class WhatsAppTemplatesController {
  constructor(private readonly service: WhatsAppTemplatesService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  async listTemplates(@CurrentUser() user: AuthUser) {
    return this.service.listTemplates(user.organizationId);
  }

  /** Recruiter picker for send-now flows (Interview / Application detail). */
  @Get('for-send')
  @RequireAnyPermissions('APPLICATION_VIEW', 'VACANCY_VIEW')
  async listForSend(
    @CurrentUser() user: AuthUser,
    @Query('interviewType') interviewType?: string,
  ) {
    return this.service.listForSend(user.organizationId, interviewType?.trim() || undefined);
  }

  @Get(':id')
  @RequirePermissions('MASTER_DATA_VIEW')
  async getTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getTemplate(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('whatsapp_template.create')
  async createTemplate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWhatsAppTemplateDto,
  ) {
    return this.service.createTemplate(user.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('whatsapp_template.update')
  async updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.service.updateTemplate(user.organizationId, id, dto);
  }

  @Post(':id/duplicate')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('whatsapp_template.duplicate')
  async duplicateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.duplicateTemplate(user.organizationId, id);
  }

  @Post(':id/preview')
  @RequireAnyPermissions('APPLICATION_VIEW', 'VACANCY_VIEW')
  @HttpCode(HttpStatus.OK)
  async preview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenderWhatsAppTemplateDto,
  ) {
    const template = await this.service.getTemplate(user.organizationId, id);
    const vars = {
      candidateName: dto.candidateName ?? '',
      positionTitle: dto.positionTitle ?? '',
      organizationName: dto.organizationName ?? '',
      interviewType: dto.interviewType ?? '',
      interviewDate: dto.interviewDate ?? '',
      recruiterName: dto.recruiterName ?? 'Recruiter',
    };
    const body = dto.bodyOverride?.trim()
      ? dto.bodyOverride
      : WhatsAppTemplatesService.render(template.bodyTemplate, vars);
    const waMeUrl = dto.phone
      ? WhatsAppTemplatesService.buildWaMeUrl(dto.phone, body)
      : WhatsAppTemplatesService.buildWaMeUrl('', body);
    return { body, waMeUrl, template };
  }

  @Delete(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('whatsapp_template.archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archiveTemplate(user.organizationId, id);
  }
}
