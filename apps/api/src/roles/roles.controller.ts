import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { RolesService } from './roles.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('ROLES_VIEW')
  list() {
    return this.rolesService.list();
  }

  @Get('permissions')
  @RequirePermissions('ROLES_VIEW')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get(':id')
  @RequirePermissions('ROLES_VIEW')
  getById(@Param('id') id: string) {
    return this.rolesService.getById(id);
  }

  @Post()
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_CREATE')
  create(@Body() body: CreateRoleDto) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_UPDATE')
  update(@Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.rolesService.update(id, body);
  }

  @Post(':id/permissions/:permissionId')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_ASSIGN_PERMISSION')
  assignPermission(@Param('id') id: string, @Param('permissionId') permissionId: string) {
    return this.rolesService.assignPermission(id, permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermissions('ROLES_MANAGE')
  @AuditAction('ROLE_REMOVE_PERMISSION')
  removePermission(@Param('id') id: string, @Param('permissionId') permissionId: string) {
    return this.rolesService.removePermission(id, permissionId);
  }
}
