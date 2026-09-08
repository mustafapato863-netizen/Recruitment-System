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
import {
  UpdateNavigationSettingsDto,
  UpdateRoleNavigationVisibilityDto,
  UpdateRlsPoliciesDto,
  UpdateUserResponsibilityDto,
} from './access-control.dto';
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

  /** Navigation metadata is safe for every authenticated user; visibility is not access control. */
  @Get('navigation')
  getNavigation(@CurrentUser() user: AuthUser) {
    return this.accessControlService.getNavigationSettings(user.organizationId, user.roleCodes);
  }

  @Put('navigation')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('NAVIGATION_SETTINGS_UPDATE')
  updateNavigation(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateNavigationSettingsDto,
  ) {
    return this.accessControlService.updateNavigationSettings(user.organizationId, body);
  }

  @Put('navigation/roles/:roleCode')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_NAVIGATION_VISIBILITY_UPDATE')
  updateRoleNavigation(
    @CurrentUser() user: AuthUser,
    @Param('roleCode') roleCode: string,
    @Body() body: UpdateRoleNavigationVisibilityDto,
  ) {
    return this.accessControlService.updateRoleNavigationVisibility(user.organizationId, roleCode, body);
  }

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

  @Get('user-responsibilities')
  @RequirePermissions('USERS_VIEW')
  getUserResponsibilities(@CurrentUser() user: AuthUser) {
    return this.accessControlService.getUserResponsibilities(user.organizationId);
  }

  @Put('user-responsibilities/:userId')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_RESPONSIBILITIES_UPDATE')
  updateUserResponsibility(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: UpdateUserResponsibilityDto,
  ) {
    return this.accessControlService.updateUserResponsibility(user.organizationId, userId, body);
  }
}
