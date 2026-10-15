import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ApplyWorkflowRuleDto, WorkflowRuleDto } from './workflow-rules.dto';
import { WorkflowRulesService } from './workflow-rules.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@UseGuards(JwtAuthGuard)
@Controller('workflow-rules')
export class WorkflowRulesController {
  constructor(private readonly rules: WorkflowRulesService) {}

  @Get()
  @RequirePermissions('MASTER_DATA_VIEW')
  list(@CurrentUser() user: AuthUser) {
    return this.rules.list(user.organizationId);
  }

  @Post('preview')
  @RequirePermissions('MASTER_DATA_VIEW')
  preview(@CurrentUser() user: AuthUser, @Body() body: WorkflowRuleDto) {
    return this.rules.preview(user.organizationId, body.positionId, body.profile);
  }

  @Post('apply')
  @RequirePermissions('MASTER_DATA_MANAGE')
  apply(@CurrentUser() user: AuthUser, @Body() body: ApplyWorkflowRuleDto) {
    return this.rules.apply(user, body.positionId, body.profile, body.reason);
  }
}
