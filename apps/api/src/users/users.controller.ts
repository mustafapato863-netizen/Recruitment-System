import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('USERS_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('USERS_VIEW')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateUserDto) {
    return this.usersService.create(user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_UPDATE')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(user.organizationId, id, body);
  }

  @Post(':id/roles/:roleId')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_ASSIGN_ROLE')
  assignRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.usersService.assignRole(user.organizationId, id, roleId);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_REMOVE_ROLE')
  removeRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.usersService.removeRole(user.organizationId, id, roleId);
  }
}
