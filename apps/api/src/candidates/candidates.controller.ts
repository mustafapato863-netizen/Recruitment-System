import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
// Runtime service and DTO imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { CandidatesService } from './candidates.service';
import { CandidateActivityService } from './candidate-activity.service';
import { CreateCandidateActivityDto, CandidateActivityQueryDto, RescheduleCandidateActivityDto } from './candidate-activity.dto';
import {
  CreateCandidateDto,
  UpdateCandidateDto,
  CandidateQueryDto,
} from './candidates.dto';
import { UserPermissionsService } from '../common/user-permissions.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly userPermissions: UserPermissionsService,
    private readonly activityService: CandidateActivityService,
  ) {}

  @Get()
  @RequirePermissions('CANDIDATE_VIEW')
  async listCandidates(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenantId: string,
    @Query() query: CandidateQueryDto,
  ) {
    const viewPii = await this.userPermissions.hasPermission(user.userId, tenantId, 'VIEW_CANDIDATE_PII');
    return this.candidatesService.listCandidates(tenantId, query, { viewPii }, user);
  }

  @Get('export.xlsx')
  @RequirePermissions('CANDIDATE_VIEW')
  @AuditAction('CANDIDATE_EXPORT_XLSX')
  async exportExcel(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenantId: string,
    @Query() query: CandidateQueryDto,
  ) {
    const viewPii = await this.userPermissions.hasPermission(user.userId, tenantId, 'VIEW_CANDIDATE_PII');
    const workbook = await this.candidatesService.exportExcel(tenantId, query, { viewPii }, user);
    return new StreamableFile(workbook, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="recruitflow-candidates.xlsx"',
    });
  }

  @Get('metrics')
  @RequirePermissions('CANDIDATE_VIEW')
  async getMetrics(@CurrentUser() user: AuthUser, @CurrentTenant() tenantId: string) {
    return this.candidatesService.getMetrics(tenantId, user);
  }

  @Get('duplicates')
  @RequirePermissions('CANDIDATE_VIEW')
  async findDuplicates(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenantId: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    const viewPii = await this.userPermissions.hasPermission(user.userId, tenantId, 'VIEW_CANDIDATE_PII');
    return this.candidatesService.findDuplicateSuggestions(
      tenantId,
      {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      },
      user,
      { viewPii },
    );
  }

  @Get(':id/activities')
  @RequirePermissions('CANDIDATE_VIEW')
  listActivities(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: CandidateActivityQueryDto) {
    return this.activityService.list(user, id, query);
  }

  @Post(':id/activities')
  @RequirePermissions('CANDIDATE_VIEW', 'CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_ACTIVITY_LOG')
  createActivity(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCandidateActivityDto) {
    return this.activityService.create(user, id, dto);
  }

  @Post(':id/activities/:taskId/complete')
  @RequirePermissions('CANDIDATE_VIEW', 'CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_ACTIVITY_COMPLETE')
  completeActivity(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.activityService.complete(user, id, taskId);
  }

  @Patch(':id/activities/:taskId/reschedule')
  @RequirePermissions('CANDIDATE_VIEW', 'CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_ACTIVITY_RESCHEDULE')
  rescheduleActivity(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: RescheduleCandidateActivityDto,
  ) {
    return this.activityService.reschedule(user, id, taskId, dto.dueAt);
  }

  @Get(':id')
  @RequirePermissions('CANDIDATE_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidate', param: 'id' })
  async getCandidate(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const viewPii = await this.userPermissions.hasPermission(user.userId, tenantId, 'VIEW_CANDIDATE_PII');
    return this.candidatesService.getCandidate(tenantId, id, { viewPii }, user);
  }

  @Post()
  @RequirePermissions('CANDIDATE_CREATE')
  @AuditAction('CANDIDATE_CREATE')
  async createCandidate(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenantId: string,
    @Body() body: CreateCandidateDto,
  ) {
    return this.candidatesService.createCandidate(tenantId, body, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidate', param: 'id' })
  async updateCandidate(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCandidateDto,
  ) {
    return this.candidatesService.updateCandidate(tenantId, id, body, user);
  }
}
