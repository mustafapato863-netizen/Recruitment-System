import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
// The service class is needed at runtime for Nest dependency metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { VacancyCoreService } from './vacancy-core.service';
import { UpdateVacancyStatusDto, AssignTeamMemberDto } from './vacancy-core.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

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
  getVacancy(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vacancyCoreService.getVacancyDetail(user.organizationId, id);
  }

  @Patch(':id/status')
  @RequirePermissions('VACANCY_MANAGE')
  @AuditAction('VACANCY_STATUS_UPDATE')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
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
  assignTeamMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: AssignTeamMemberDto,
  ) {
    return this.vacancyCoreService.assignTeamMember(id, user.organizationId, body);
  }
}
