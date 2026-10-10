import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MyWorkService } from './my-work.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** B4: the signed-in user's own work. Scoped to the caller; no permission beyond sign-in. */
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MyWorkController {
  constructor(private readonly myWork: MyWorkService) {}

  @Get('work')
  getMyWork(@CurrentUser() user: AuthUser, @Query('day') day?: string) {
    // E1: day=today|tomorrow (Cairo days), default today.
    if (day !== undefined && day !== 'today' && day !== 'tomorrow') {
      throw new BadRequestException('day must be today or tomorrow');
    }
    return this.myWork.getMyWork(user, new Date(), day ?? 'today');
  }
}
