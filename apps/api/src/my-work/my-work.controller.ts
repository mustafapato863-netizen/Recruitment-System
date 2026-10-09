import { Controller, Get, UseGuards } from '@nestjs/common';
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
  getMyWork(@CurrentUser() user: AuthUser) {
    return this.myWork.getMyWork(user);
  }
}
