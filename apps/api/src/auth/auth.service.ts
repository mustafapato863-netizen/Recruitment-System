import { Injectable, UnauthorizedException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import * as bcrypt from 'bcryptjs';
import type { UserProfile } from '@recruitflow/contracts';
import { requireJwtSecret } from './jwt-secrets';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailNormalized: email.trim().toLowerCase() },
    });
    if (user && user.passwordHash) {
      const isMatch = await bcrypt.compare(pass, user.passwordHash);
      if (isMatch) {
        return user;
      }
    }
    return null;
  }

  async login(email: string, pass: string) {
    const user = await this.validateUser(email, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'Active') {
      throw new UnauthorizedException('User account is inactive');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.generateAccessToken(user.id, user.organizationId, user.tokenVersion);
    const refreshToken = await this.generateRefreshToken(user.id, user.organizationId, user.tokenVersion);
    const userProfile = await this.getUserProfile(user.id);

    return {
      accessToken,
      refreshToken,
      user: userProfile,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async generateAccessToken(userId: string, organizationId: string, tokenVersion: number) {
    const payload = { sub: userId, organizationId, tokenVersion };
    const secret = requireJwtSecret(this.configService, 'JWT_ACCESS_SECRET');
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '15m',
    });
  }

  async generateRefreshToken(userId: string, organizationId: string, tokenVersion: number) {
    const payload = { sub: userId, organizationId, tokenVersion };
    const secret = requireJwtSecret(this.configService, 'JWT_REFRESH_SECRET');
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '7d',
    });
  }

  async rotateRefreshToken(userId: string, tokenVersion: number): Promise<number> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, tokenVersion, status: 'Active' },
      data: { tokenVersion: { increment: 1 } },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    return tokenVersion + 1;
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        userRoles: {
          where: { role: { status: 'Active' } },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = (user.userRoles || []).map((ur) => ({
      id: ur.role.id,
      code: ur.role.code,
      name: ur.role.name,
    }));

    const permissions = Array.from(
      new Set(
        (user.userRoles || []).flatMap((ur) =>
          (ur.role.permissions || []).map((rp) => rp.permission.code),
        ),
      ),
    );

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      organizationId: user.organizationId,
      organizationName: user.organization?.name || '',
      roles,
      permissions,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }
}
