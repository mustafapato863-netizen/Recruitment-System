import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { HiringService } from './hiring.service';
import {
  CreateHiringCaseDto,
  UpdateComplianceDto,
  FinalApprovalDto,
  JoiningUpdateDto,
} from './hiring.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('hiring')
export class HiringController {
  constructor(private readonly hiringService: HiringService) {}

  @Post()
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('HIRING_CASE_CREATE')
  createHiringCase(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateHiringCaseDto,
  ) {
    return this.hiringService.createHiringCase(user.organizationId, dto, user);
  }

  @Get('metrics')
  @RequirePermissions('APPLICATION_VIEW')
  getMetrics(@CurrentUser() user: AuthUser) {
    return this.hiringService.getMetrics(user.organizationId);
  }

  @Get('final-approvals')
  @RequirePermissions('FINAL_HIRING_APPROVAL')
  getFinalApprovalInbox(@CurrentUser() user: AuthUser) {
    return this.hiringService.getFinalApprovalInbox(user.organizationId);
  }

  @Get()
  @RequirePermissions('APPLICATION_VIEW')
  listHiringCases(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.hiringService.listHiringCases(user.organizationId, status);
  }

  @Get(':id')
  @RequirePermissions('APPLICATION_VIEW')
  getHiringCase(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.hiringService.getHiringCase(user.organizationId, id);
  }

  @Patch(':id/compliance/:reqId')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('HIRING_COMPLIANCE_UPDATE')
  updateCompliance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() dto: UpdateComplianceDto,
  ) {
    return this.hiringService.updateCompliance(
      user.organizationId,
      id,
      reqId,
      dto,
      user,
    );
  }

  @Post(':id/submit')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('HIRING_FINAL_APPROVAL_SUBMIT')
  submitForFinalApproval(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.hiringService.submitForFinalApproval(user.organizationId, id, user);
  }

  @Post(':id/final-approval')
  @RequirePermissions('FINAL_HIRING_APPROVAL')
  @AuditAction('HIRING_FINAL_APPROVAL_DECIDE')
  decideFinalApproval(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FinalApprovalDto,
  ) {
    return this.hiringService.decideFinalApproval(user.organizationId, id, dto, user);
  }

  @Post(':id/joining')
  @RequirePermissions('FINAL_HIRING_APPROVAL')
  @AuditAction('HIRING_JOINING_UPDATE')
  confirmJoining(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: JoiningUpdateDto,
  ) {
    return this.hiringService.confirmJoining(user.organizationId, id, dto, user);
  }
}
