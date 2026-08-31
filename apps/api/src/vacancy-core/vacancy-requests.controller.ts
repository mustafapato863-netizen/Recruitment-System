import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
// DTO classes must remain runtime imports so Nest can reflect their metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import {
  CreateVacancyRequestDto,
  UpdateVacancyRequestDto,
  VacancyRequestActionDto,
} from './vacancy-core.dto';
import { VacancyCoreService } from './vacancy-core.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vacancy-requests')
export class VacancyRequestsController {
  constructor(private readonly vacancyCoreService: VacancyCoreService) {}

  @Get('context')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  getContext(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.getContext(user.organizationId, user.userId);
  }

  @Get()
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  listRequests(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.listRequests(user.organizationId);
  }

  @Get('inbox')
  @RequirePermissions('VACANCY_REQUEST_APPROVE')
  getApproverInbox(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.getApproverInbox(user.organizationId, user.roleCodes);
  }

  @Get(':id')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  getRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.getRequest(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('CreateVacancyRequest')
  createRequest(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateVacancyRequestDto,
  ) {
    return this.vacancyCoreService.createRequest(user.organizationId, user.userId, body);
  }

  @Patch(':id')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  updateRequest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVacancyRequestDto,
  ) {
    return this.vacancyCoreService.updateRequest(id, user.organizationId, body);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_SUBMIT')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  submitRequest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.submitRequest(id, user.organizationId, user.userId, body);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VACANCY_REQUEST_APPROVE')
  @AuditAction('VACANCY_REQUEST_APPROVE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  approveRequest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.approveRequest(id, user.organizationId, user.userId, user.roleCodes, body);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VACANCY_REQUEST_APPROVE')
  @AuditAction('VACANCY_REQUEST_CHANGES_REQUESTED')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  requestChanges(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.requestChanges(id, user.organizationId, user.userId, user.roleCodes, body);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VACANCY_REQUEST_APPROVE')
  @AuditAction('VACANCY_REQUEST_REJECT')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  rejectRequest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.rejectRequest(id, user.organizationId, user.userId, user.roleCodes, body);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_CANCEL')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  cancelRequest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacancyCoreService.cancelRequest(id, user.organizationId, user.userId);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VACANCY_MANAGE')
  @AuditAction('VACANCY_CONVERT')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  convertToVacancy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacancyCoreService.convertToVacancy(id, user.organizationId);
  }
}
