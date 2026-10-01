import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './email-templates.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequireAnyPermissions, RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Get()
  @RequireAnyPermissions('MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW')
  async listTemplates(@CurrentUser() user: AuthUser) {
    return this.service.listTemplates(user.organizationId);
  }

  @Get(':id')
  @RequireAnyPermissions('MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW')
  async getTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getTemplate(user.organizationId, id);
  }

  @Post()
  @RequireAnyPermissions('MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW')
  @AuditAction('email_template.create')
  async createTemplate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEmailTemplateDto,
  ) {
    return this.service.createTemplate(user.organizationId, dto);
  }

  @Patch(':id')
  @RequireAnyPermissions('MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW')
  @AuditAction('email_template.update')
  async updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.service.updateTemplate(user.organizationId, id, dto);
  }

  @Post(':id/duplicate')
  @RequireAnyPermissions('MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW')
  @AuditAction('email_template.duplicate')
  async duplicateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.duplicateTemplate(user.organizationId, id);
  }

  @Delete(':id')
  @RequireAnyPermissions('MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW')
  @AuditAction('email_template.archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archiveTemplate(user.organizationId, id);
  }
}
