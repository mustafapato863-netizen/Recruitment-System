import { Controller, Get, Patch, Post, Param, ParseUUIDPipe, Body, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { IntegrationsService } from './integrations.service';
import { UpdateIntegrationDto } from './integrations.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  async listIntegrations(@CurrentUser() user: AuthUser) {
    return this.service.listIntegrations(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('MASTER_DATA_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'integration', param: 'id' })
  async getIntegration(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getIntegration(user.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('INTEGRATION_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'integration', param: 'id' })
  async updateIntegration(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntegrationDto
  ) {
    return this.service.updateIntegration(user.organizationId, id, dto);
  }

  @Post(':id/test')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('INTEGRATION_TEST')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'integration', param: 'id' })
  async testIntegration(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.testIntegration(user.organizationId, id);
  }
}
