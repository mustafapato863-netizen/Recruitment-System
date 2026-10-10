import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AdminOverrideService } from './admin-override.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('admin/overrides')
export class AdminOverrideController {
  constructor(private readonly service: AdminOverrideService) {}

  /** body: { action: 'job.hold' | 'job.reopen' | 'job.close', entityId, reason, note?, holdUntil? } */
  @Post()
  override(@CurrentUser() user: AuthUser, @Body() body: { action?: string; entityId?: string; reason?: string; note?: string; holdUntil?: string }) {
    return this.service.override(user, body ?? {});
  }
}
