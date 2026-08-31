import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { VacancyCoreService } from './vacancy-core.service';
import { UpdateVacancyStatusDto, AssignTeamMemberDto } from './vacancy-core.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vacancies')
export class VacanciesController {
  constructor(private readonly vacancyCoreService: VacancyCoreService) {}

  @Get()
  @RequirePermissions('VACANCY_VIEW')
  listVacancies(@CurrentUser() user: AuthUser) {
    return this.vacancyCoreService.listVacancies(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('VACANCY_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  getVacancy(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vacancyCoreService.getVacancyDetail(user.organizationId, id);
  }

  @Patch(':id/status')
  @RequirePermissions('VACANCY_MANAGE')
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
    );
  }

  @Post(':id/assignments')
  @RequirePermissions('VACANCY_MANAGE')
  @AuditAction('VACANCY_ASSIGN_TEAM')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'vacancy', param: 'id' })
  assignTeamMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignTeamMemberDto,
  ) {
    return this.vacancyCoreService.assignTeamMember(id, user.organizationId, body);
  }
}
