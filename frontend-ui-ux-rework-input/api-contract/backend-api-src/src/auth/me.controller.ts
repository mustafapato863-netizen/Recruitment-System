import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ChangePasswordDto, UpdateSelfProfileDto, UpdateUserPreferencesDto } from './auth.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AuthService } from './auth.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getOwnProfile(user.userId, user.organizationId);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: UpdateSelfProfileDto) {
    return this.authService.updateOwnProfile(user.userId, user.organizationId, body);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.authService.getOwnPreferences(user.userId, user.organizationId);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthUser, @Body() body: UpdateUserPreferencesDto) {
    return this.authService.updateOwnPreferences(user.userId, user.organizationId, body);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto) {
    await this.authService.changeOwnPassword(user.userId, user.organizationId, body);
    return { message: 'Password updated successfully' };
  }
}
