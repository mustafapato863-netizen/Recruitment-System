import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Res, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ChangePasswordDto, UpdateSelfProfileDto, UpdateUserPreferencesDto } from './auth.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AuthService } from './auth.service';
import { authCookieOptions, sessionHintCookieOptions } from './auth.controller';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import type { Response } from 'express';

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
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    // tokenVersion++ inside changeOwnPassword invalidates the caller's own
    // tokens too, so reissue fresh cookies (same helper as login/refresh)
    // and return the updated profile with mustChangePassword cleared.
    const result = await this.authService.changeOwnPassword(user.userId, user.organizationId, body);
    const accessToken = await this.authService.generateAccessToken(user.userId, user.organizationId, result.tokenVersion);
    const refreshToken = await this.authService.generateRefreshToken(user.userId, user.organizationId, result.tokenVersion);
    response.cookie('access_token', accessToken, authCookieOptions('/api/v1'));
    response.cookie('refresh_token', refreshToken, authCookieOptions('/api/v1/auth/refresh'));
    response.cookie('rf_has_session', '1', sessionHintCookieOptions());
    return { message: 'Password updated successfully', user: result.user };
  }
}
