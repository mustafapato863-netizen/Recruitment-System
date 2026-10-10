import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { VacancyCoreService } from './vacancy-core.service';
import { UpdateVacancyStatusDto, UpdateVacancyDto, AssignTeamMemberDto, VacancyWorkQueueQueryDto, JobStatusReasonDto, DeleteVacancyDto } from './vacancy-core.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vacancies')
export class VacanciesController {
  constructor(private readonly vacancyCoreService: VacancyCoreService) {}

  @Get()
  @RequirePermissions('VACANCY_VIEW')
  listVacancies(@CurrentUser() user: AuthUser, @Query('mine') mine?: string) {
    return this.vacancyCoreService.listVacancies(user.organizationId, user, { mine: mine === 'true' });
  }

  @Get('work-queue')
  @RequirePermissions('VACANCY_VIEW')
  getWorkQueue(@CurrentUser() user: AuthUser, @Query() query: VacancyWorkQueueQueryDto) {
    return this.vacancyCoreService.getWorkQueue(user.organizationId, query, user);
  }

  @Get('export.xlsx')
  @RequirePermissions('VACANCY_VIEW')
  @AuditAction('VACANCY_EXPORT_XLSX')
  async exportExcel(@CurrentUser() user: AuthUser) {
    const workbook = await this.vacancyCoreService.exportExcel(user.organizationId, user);
    return new StreamableFile(workbook, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="recruitflow-vacancies.xlsx"',
    });
  }

  @Get(':id')
  @RequirePermissions('VACANCY_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  getVacancy(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vacancyCoreService.getVacancyDetail(user.organizationId, id, user);
  }

  @Patch(':id/status')
  // B3: owner/manager is enforced in the service (v2 §3 Hold); recruiters own jobs without VACANCY_MANAGE.
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_VIEW')
  @AuditAction('VACANCY_STATUS_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVacancyStatusDto,
  ) {
    return this.vacancyCoreService.updateVacancyStatus(
      id,
      user.organizationId,
      body.status,
      user,
      body.reason,
    );
  }

  @Post(':id/hold')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_VIEW')
  @AuditAction('VACANCY_HOLD')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  hold(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: JobStatusReasonDto) {
    return this.vacancyCoreService.holdVacancy(id, user.organizationId, body.reason, user, { note: body.note, holdUntil: body.holdUntil });
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_VIEW')
  @AuditAction('VACANCY_REOPEN')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  reopen(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: JobStatusReasonDto) {
    return this.vacancyCoreService.reopenVacancy(id, user.organizationId, body.reason, user);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_VIEW')
  @AuditAction('VACANCY_CLOSE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: JobStatusReasonDto) {
    return this.vacancyCoreService.closeVacancy(id, user.organizationId, body.reason, user, { note: body.note });
  }

  @Get(':id/status-history')
  @RequirePermissions('VACANCY_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  statusHistory(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vacancyCoreService.getVacancyStatusHistory(user.organizationId, id, user);
  }

  /** B2F-10: VACANCY_MANAGE edits everything; the job owner / owner's manager may set requiredSkills only. */
  @Patch(':id')
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_VIEW')
  @AuditAction('VACANCY_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  updateVacancy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVacancyDto,
  ) {
    return this.vacancyCoreService.updateVacancy(id, user.organizationId, body, user);
  }

  /** B2: DELETE deactivates (status Cancelled); nothing is removed. */
  /** B2R-2/3: owner or owner's manager (admin = audited override); everyone sends {reason, note?} from close-reasons. */
  @Delete(':id')
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_VIEW')
  @AuditAction('VACANCY_DEACTIVATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  deleteVacancy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeleteVacancyDto = {},
  ) {
    return this.vacancyCoreService.deleteVacancy(id, user.organizationId, user, body ?? {});
  }

  @Post(':id/assignments')
  @RequireAnyPermissions('VACANCY_MANAGE', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN')
  @AuditAction('VACANCY_ASSIGN_TEAM')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  assignTeamMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignTeamMemberDto,
  ) {
    return this.vacancyCoreService.assignTeamMember(id, user.organizationId, body, user);
  }
}
