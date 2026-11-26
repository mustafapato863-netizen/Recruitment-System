import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser, JdCriteriaDefinition } from '@recruitflow/contracts';
// DTO classes must remain runtime imports so Nest can reflect their metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import {
  CreateVacancyRequestDto,
  UpdateVacancyRequestDto,
  VacancyRequestActionDto,
  CancelVacancyRequestDto,
  ActivateVacancyRequestDto,
  UpdateRequisitionTargetDto,
} from './vacancy-core.dto';
import { VacancyCoreService } from './vacancy-core.service';
import { VacancyDocumentsService } from './vacancy-documents.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vacancy-requests')
export class VacancyRequestsController {
  constructor(
    private readonly vacancyCoreService: VacancyCoreService,
    private readonly vacancyDocuments: VacancyDocumentsService,
  ) {}

  @Get('context')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  getContext(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.getContext(user.organizationId, user.userId);
  }

  @Get()
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  listRequests(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.listRequests(user.organizationId, user);
  }

  @Get('inbox')
  @RequirePermissions('VACANCY_REQUEST_APPROVE')
  getApproverInbox(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.getApproverInbox(user.organizationId, user.roleCodes, user.userId);
  }

  @Get(':id')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  getRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.getRequest(user.organizationId, id, user);
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

  @Get(':id/cancel-impact')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  cancelImpact(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vacancyCoreService.getCancellationImpact(id, user.organizationId);
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
    @Body() body: CancelVacancyRequestDto = {},
  ) {
    return this.vacancyCoreService.cancelRequest(id, user.organizationId, user.userId, body?.reason, body?.note);
  }

  /** M1: Manager changes seats / due date of an activated requisition (reason required; history + audit). */
  @Patch(':id/target')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_TARGET_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  updateTarget(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRequisitionTargetDto,
  ) {
    return this.vacancyCoreService.updateRequisitionTarget(id, user.organizationId, user.userId, body);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  // B2-2: the requesting Manager activates his own requisition (the service checks requester/manager or VACANCY_MANAGE).
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_ACTIVATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancyRequest', param: 'id' })
  activate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ActivateVacancyRequestDto = {},
  ) {
    return this.vacancyCoreService.activateRequest(id, user.organizationId, user.userId, { assignedEmployeeId: body?.assignedEmployeeId ?? null });
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
    // Deprecated alias of /activate (B3).
    return this.vacancyCoreService.convertToVacancy(id, user.organizationId, user.userId);
  }

  @Post(':id/jd')
  @RequireAnyPermissions('VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE')
  @UseInterceptors(FileInterceptor('file'))
  uploadJd(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('A PDF, DOCX, or text file is required.');
    return this.vacancyDocuments.uploadRequisitionJd(user.organizationId, id, file, user);
  }

  @Get(':id/jd')
  @RequireAnyPermissions('VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_VIEW', 'VACANCY_MANAGE')
  getJd(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vacancyDocuments.getVacancyJd(user.organizationId, id);
  }

  @Patch(':id/criteria')
  @RequireAnyPermissions('VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE')
  updateCriteria(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() criteria: Partial<JdCriteriaDefinition>,
  ) {
    return this.vacancyDocuments.updateVacancyCriteria(user.organizationId, id, criteria, user);
  }

  @Post(':id/jd-text')
  @RequireAnyPermissions('VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE')
  saveJdText(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('text') text: string,
    @Body('fileName') fileName?: string,
  ) {
    if (!text || typeof text !== 'string') throw new BadRequestException('Job description text is required.');
    return this.vacancyDocuments.saveJdText(user.organizationId, id, text, user, fileName);
  }
}
