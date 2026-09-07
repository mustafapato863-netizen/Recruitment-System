import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AccessControlService } from './access-control.service';
import { UpdateRlsPoliciesDto } from './access-control.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get('rls-policies')
  @RequirePermissions('ROLES_VIEW')
  getRlsPolicies(@CurrentUser() user: AuthUser) {
    return this.accessControlService.getRlsPolicies(user.organizationId);
  }

  @Put('rls-policies')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('RLS_POLICY_UPDATE')
  updateRlsPolicies(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateRlsPoliciesDto,
  ) {
    return this.accessControlService.updateRlsPolicies(user.organizationId, body);
  }

  @Get('audit-simulation/:roleCode')
  @RequirePermissions('ROLES_VIEW')
  getAuditSimulation(
    @CurrentUser() user: AuthUser,
    @Param('roleCode') roleCode: string,
  ) {
    return this.accessControlService.getAuditSimulation(user.organizationId, roleCode);
  }
}
