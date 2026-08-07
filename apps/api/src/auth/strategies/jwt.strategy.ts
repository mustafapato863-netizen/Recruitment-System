import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AuthUser } from '@recruitflow/contracts';
import { requireJwtSecret } from '../jwt-secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Record<string, { access_token?: string } | undefined>) => {
          return request?.cookies?.access_token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(configService, 'JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; tokenVersion: number }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { userRoles: { where: { role: { status: 'Active' } }, include: { role: true } } },
    });

    if (!user || user.status !== 'Active' || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token is invalid or expired');
    }

    return {
      userId: user.id,
      organizationId: user.organizationId,
      tokenVersion: user.tokenVersion,
      roleCodes: user.userRoles.map((userRole) => userRole.role.code),
    };
  }
}
