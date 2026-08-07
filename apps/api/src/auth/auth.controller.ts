import { Controller, Post, Body, Res, UseGuards, Get, HttpStatus, HttpCode } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto.email, loginDto.password);

    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1',
    });

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
    });

    return { user: result.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.userId);

    response.cookie('access_token', '', { expires: new Date(0), path: '/api/v1' });
    response.cookie('refresh_token', '', { expires: new Date(0), path: '/api/v1/auth/refresh' });

    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  async refresh(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    const tokenVersion = await this.authService.rotateRefreshToken(user.userId, user.tokenVersion);
    const accessToken = await this.authService.generateAccessToken(user.userId, user.organizationId, tokenVersion);
    const refreshToken = await this.authService.generateRefreshToken(user.userId, user.organizationId, tokenVersion);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1',
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
    });

    return { message: 'Token refreshed' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getUserProfile(user.userId);
  }
}
