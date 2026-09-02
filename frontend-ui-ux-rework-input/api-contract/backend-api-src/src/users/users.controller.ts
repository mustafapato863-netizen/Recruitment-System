import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, CreateInvitationDto } from './users.dto';
import { AuthService } from '../auth/auth.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('interviewers')
  @RequirePermissions('VACANCY_VIEW')
  listInterviewers(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.organizationId);
  }

  @Get()
  @RequirePermissions('USERS_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('USERS_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'user', param: 'id' })
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateUserDto) {
    return this.usersService.create(user.organizationId, body);
  }

  @Post('invitations')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_INVITE')
  createInvitation(@CurrentUser() user: AuthUser, @Body() body: CreateInvitationDto) {
    return this.authService.createInvitation(
      user.organizationId,
      body.email,
      body.displayName,
      body.roleIds,
    );
  }

  @Patch(':id')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'user', param: 'id' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(user.organizationId, id, body);
  }

  @Post(':id/roles/:roleId')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_ASSIGN_ROLE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'user', param: 'id' })
  assignRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.usersService.assignRole(user.organizationId, id, roleId);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('USERS_MANAGE')
  @AuditAction('USER_REMOVE_ROLE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'user', param: 'id' })
  removeRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.usersService.removeRole(user.organizationId, id, roleId);
  }
}
