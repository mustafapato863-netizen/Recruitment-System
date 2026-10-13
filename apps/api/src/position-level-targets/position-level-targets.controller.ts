import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-permissions.decorator';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PositionLevelTargetsService } from './position-level-targets.service';
import { SavePositionLevelTargetsDto } from './position-level-targets.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */

const READ = ['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN', 'MASTER_DATA_VIEW'] as const;
const WRITE = ['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE'] as const;

@UseGuards(JwtAuthGuard)
@Controller('position-level-targets')
export class PositionLevelTargetsController {
  constructor(private readonly targets: PositionLevelTargetsService) {}

  @Get()
  @RequireAnyPermissions(...READ)
  get(@CurrentUser() user: AuthUser) {
    return this.targets.get(user.organizationId);
  }

  @Put()
  @RequireAnyPermissions(...WRITE)
  save(@CurrentUser() user: AuthUser, @Body() body: SavePositionLevelTargetsDto) {
    return this.targets.save(user, body);
  }
}
