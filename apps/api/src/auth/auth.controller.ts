import { Controller, Post, Body, Res, Req, UseGuards, Get, HttpStatus, HttpCode } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AuthService } from './auth.service';
import {
  LoginDto,
  RequestPasswordResetDto,
  CompletePasswordResetDto,
  RequestEmailVerificationDto,
  CompleteEmailVerificationDto,
  AcceptInvitationDto,
} from './auth.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const clientIp = request.ip || request.socket?.remoteAddress || 'unknown';
    const result = await this.authService.login(loginDto.email, loginDto.password, clientIp);

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

  @Public()
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

  // ─── M1: Password Recovery ─────────────────────────────────────

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() body: RequestPasswordResetDto, @Req() request: Request) {
    return this.authService.requestPasswordReset(body, clientIpOf(request));
  }

  @Public()
  @Post('password-reset/complete')
  @HttpCode(HttpStatus.OK)
  async completePasswordReset(@Body() body: CompletePasswordResetDto, @Req() request: Request) {
    await this.authService.completePasswordReset(body, clientIpOf(request));
    return { message: 'Password has been reset successfully.' };
  }

  // ─── M1: Email Verification ────────────────────────────────────

  @Public()
  @Post('email-verification/request')
  @HttpCode(HttpStatus.OK)
  async requestEmailVerification(@Body() body: RequestEmailVerificationDto, @Req() request: Request) {
    return this.authService.requestEmailVerification(body, clientIpOf(request));
  }

  @Public()
  @Post('email-verification/complete')
  @HttpCode(HttpStatus.OK)
  async completeEmailVerification(@Body() body: CompleteEmailVerificationDto, @Req() request: Request) {
    await this.authService.completeEmailVerification(body, clientIpOf(request));
    return { message: 'Email verified successfully.' };
  }

  // ─── M1: Invitation Acceptance ─────────────────────────────────

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(@Body() body: AcceptInvitationDto, @Req() request: Request) {
    await this.authService.acceptInvitation(body, clientIpOf(request));
    return { message: 'Invitation accepted. You can now sign in.' };
  }
}

function clientIpOf(request: Request): string | undefined {
  return request.ip || request.socket?.remoteAddress || undefined;
}
