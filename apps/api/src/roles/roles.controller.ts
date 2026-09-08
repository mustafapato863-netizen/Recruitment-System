import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { RolesService } from './roles.service';
import {
  CreatePermissionDto,
  CreateRoleDto,
  UpdatePermissionDto,
  UpdateRoleDto,
} from './roles.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('ROLES_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.rolesService.list(user.organizationId);
  }

  @Get('permissions')
  @RequirePermissions('ROLES_VIEW')
  listPermissions(@CurrentUser() user: AuthUser) {
    return this.rolesService.listPermissions(user.organizationId);
  }

  @Post('permissions')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('PERMISSION_CREATE')
  createPermission(@CurrentUser() user: AuthUser, @Body() body: CreatePermissionDto) {
    return this.rolesService.createPermission(user.organizationId, body);
  }

  @Patch('permissions/:permissionId')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('PERMISSION_UPDATE')
  updatePermission(
    @CurrentUser() user: AuthUser,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Body() body: UpdatePermissionDto,
  ) {
    return this.rolesService.updatePermission(user.organizationId, permissionId, body);
  }

  @Delete('permissions/:permissionId')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('PERMISSION_DELETE')
  async deletePermission(
    @CurrentUser() user: AuthUser,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    await this.rolesService.deletePermission(user.organizationId, permissionId);
    return { deleted: true };
  }

  @Get(':id')
  @RequirePermissions('ROLES_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'role', param: 'id' })
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRoleDto) {
    return this.rolesService.create(user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'role', param: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoleDto,
  ) {
    return this.rolesService.update(user.organizationId, id, body);
  }

  @Post(':id/permissions/:permissionId')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_ASSIGN_PERMISSION')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'role', param: 'id' })
  assignPermission(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rolesService.assignPermission(user.organizationId, id, permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_REMOVE_PERMISSION')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'role', param: 'id' })
  removePermission(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rolesService.removePermission(user.organizationId, id, permissionId);
  }

  @Delete(':id')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_DELETE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'role', param: 'id' })
  async delete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.rolesService.delete(user.organizationId, id);
    return { deleted: true };
  }
}
