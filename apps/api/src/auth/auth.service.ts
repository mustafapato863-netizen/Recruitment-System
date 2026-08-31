import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailOutboxService } from '../email/email-outbox.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Prisma } from '@recruitflow/database';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthActionResponse,
  AuthDeliveryStatus,
  InvitationResponse,
  UserPreferences,
  UserProfile,
} from '@recruitflow/contracts';
import type {
  AcceptInvitationDto,
  ChangePasswordDto,
  CompleteEmailVerificationDto,
  CompletePasswordResetDto,
  RequestEmailVerificationDto,
  RequestPasswordResetDto,
  UpdateSelfProfileDto,
  UpdateUserPreferencesDto,
} from './auth.dto';
import { requireJwtSecret } from './jwt-secrets';

type AuthTokenType = 'PasswordReset' | 'EmailVerification' | 'Invitation';

interface AuthTokenRow {
  id: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
}

const RECOVERY_TTL_HOURS = 1;
const INVITATION_TTL_HOURS = 72;
const GENERIC_RECOVERY_RESPONSE = Object.freeze({ accepted: true as const });

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private rateLimiter: RateLimiterService,
    private emailOutbox: EmailOutboxService,
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

  async login(email: string, pass: string, ip?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limiter status
    const limitStatus = await this.rateLimiter.checkLimit(normalizedEmail, ip);
    if (limitStatus.isLocked) {
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to multiple failed login attempts',
        retryAfterSeconds: limitStatus.retryAfterSeconds,
      });
    }

    const user = await this.validateUser(email, pass);
    if (!user) {
      const failStatus = await this.rateLimiter.recordFailure(normalizedEmail, ip);
      if (failStatus.isLocked) {
        throw new ForbiddenException({
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to multiple failed login attempts',
          retryAfterSeconds: failStatus.retryAfterSeconds,
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        attemptsLeft: failStatus.attemptsLeft,
      });
    }

    if (user.status !== 'Active') {
      await this.rateLimiter.resetLimit(normalizedEmail, ip);
      throw new UnauthorizedException({
        code: 'INACTIVE_ACCOUNT',
        message: 'User account is inactive',
      });
    }

    // Success - reset attempts
    await this.rateLimiter.resetLimit(normalizedEmail, ip);

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
    const expiresIn = (
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')
      || this.configService.get<string>('JWT_ACCESS_EXPIRY')
      || '15m'
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn,
    });
  }

  async generateRefreshToken(userId: string, organizationId: string, tokenVersion: number) {
    const payload = { sub: userId, organizationId, tokenVersion };
    const secret = requireJwtSecret(this.configService, 'JWT_REFRESH_SECRET');
    const expiresIn = (
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')
      || this.configService.get<string>('JWT_REFRESH_EXPIRY')
      || '7d'
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn,
    });
  }

  async rotateRefreshToken(userId: string, tokenVersion: number): Promise<number> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, tokenVersion, status: 'Active' },
      data: { tokenVersion: { increment: 1 } },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
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
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
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

  async getOwnProfile(userId: string, organizationId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return this.getUserProfile(userId);
  }

  async updateOwnProfile(userId: string, organizationId: string, data: UpdateSelfProfileDto): Promise<UserProfile> {
    const displayName = data.displayName.trim();
    if (!displayName) {
      throw new BadRequestException('Display name is required');
    }
    const result = await this.prisma.user.updateMany({
      where: { id: userId, organizationId },
      data: { displayName },
    });
    if (result.count !== 1) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return this.getUserProfile(userId);
  }

  async getOwnPreferences(userId: string, organizationId: string): Promise<UserPreferences> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: {
        theme: true,
        timezone: true,
        dateFormat: true,
        timeFormat: true,
        reducedMotion: true,
        inAppNotifications: true,
        emailNotifications: true,
        interviewReminders: true,
        approvalReminders: true,
        taskReminders: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return {
      ...user,
      theme: user.theme === 'dark' ? 'dark' : 'light',
      timeFormat: user.timeFormat === '24h' ? '24h' : '12h',
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateOwnPreferences(userId: string, organizationId: string, data: UpdateUserPreferencesDto): Promise<UserPreferences> {
    const updateData: {
      theme?: string;
      timezone?: string;
      dateFormat?: string;
      timeFormat?: string;
      reducedMotion?: boolean;
      inAppNotifications?: boolean;
      emailNotifications?: boolean;
      interviewReminders?: boolean;
      approvalReminders?: boolean;
      taskReminders?: boolean;
    } = {};
    if (data.theme !== undefined) updateData.theme = data.theme;
    if (data.timezone !== undefined) updateData.timezone = data.timezone.trim();
    if (data.dateFormat !== undefined) updateData.dateFormat = data.dateFormat;
    if (data.timeFormat !== undefined) updateData.timeFormat = data.timeFormat;
    if (data.reducedMotion !== undefined) updateData.reducedMotion = data.reducedMotion;
    if (data.inAppNotifications !== undefined) updateData.inAppNotifications = data.inAppNotifications;
    if (data.emailNotifications !== undefined) updateData.emailNotifications = data.emailNotifications;
    if (data.interviewReminders !== undefined) updateData.interviewReminders = data.interviewReminders;
    if (data.approvalReminders !== undefined) updateData.approvalReminders = data.approvalReminders;
    if (data.taskReminders !== undefined) updateData.taskReminders = data.taskReminders;
    if (updateData.timezone === '') {
      throw new BadRequestException('Time zone is required');
    }

    const result = await this.prisma.user.updateMany({
      where: { id: userId, organizationId },
      data: updateData,
    });
    if (result.count !== 1) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return this.getOwnPreferences(userId, organizationId);
  }

  async changeOwnPassword(userId: string, organizationId: string, data: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, status: 'Active' },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
      throw new ForbiddenException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.prisma.user.updateMany({
      where: { id: userId, organizationId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
  }

  /**
   * Recovery and invitation tokens are deliberately implemented as a small
   * persistence boundary here instead of exposing an ungenerated Prisma
   * model to the running Windows API process. The schema and migration remain
   * authoritative; the generated client can be refreshed during deployment.
   */
  private async enforcePublicAuthRateLimit(
    identifier: string,
    ip: string | undefined,
    reason: string,
  ): Promise<void> {
    const status = await this.rateLimiter.checkLimit(identifier, ip);
    if (status.isLocked) {
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many attempts. Please try again later.',
        },
        429,
      );
    }
    // Every public recovery/invitation attempt consumes one window slot so the
    // cap applies to request volume, not only to failures.
    await this.rateLimiter.recordFailure(identifier, ip, undefined, reason);
  }

  async requestPasswordReset(
    data: RequestPasswordResetDto,
    ip?: string,
  ): Promise<AuthActionResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();
    await this.enforcePublicAuthRateLimit(
      normalizedEmail,
      ip,
      'Maximum password-reset requests for this account exceeded',
    );
    const user = await this.prisma.user.findFirst({
      where: { emailNormalized: normalizedEmail, status: 'Active' },
      select: { id: true, organizationId: true },
    });

    if (!user) {
      return { ...GENERIC_RECOVERY_RESPONSE, delivery: this.deliveryStatus() };
    }

    return this.issueToken(
      user.id,
      user.organizationId,
      'PasswordReset',
      RECOVERY_TTL_HOURS,
    );
  }

  async completePasswordReset(data: CompletePasswordResetDto, ip?: string): Promise<void> {
    await this.enforcePublicAuthRateLimit(
      `token-complete:${ip ?? 'unknown'}`,
      undefined,
      'Maximum password-reset completion attempts from this source exceeded',
    );
    const tokenHash = this.hashToken(data.token);
    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const token = await tx.$queryRaw<AuthTokenRow[]>`
        SELECT t."id", t."userId", t."organizationId", t."expiresAt"
        FROM "auth_tokens" t
        INNER JOIN "users" u ON u."id" = t."userId" AND u."organizationId" = t."organizationId"
        WHERE t."tokenHash" = ${tokenHash}
          AND t."type" = ${'PasswordReset'}
          AND t."consumedAt" IS NULL
          AND t."expiresAt" > CURRENT_TIMESTAMP
          AND u."status" = ${'Active'}
        FOR UPDATE
      `;

      const current = token[0];
      if (!current) {
        throw new UnauthorizedException({
          code: 'INVALID_PASSWORD_RESET_TOKEN',
          message: 'The password reset link is invalid or expired.',
        });
      }

      const updatedUsers = await tx.$executeRaw`
        UPDATE "users"
        SET "passwordHash" = ${passwordHash},
            "tokenVersion" = "tokenVersion" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = CAST(${current.userId} AS uuid)
          AND "organizationId" = CAST(${current.organizationId} AS uuid)
          AND "status" = ${'Active'}
      `;

      if (updatedUsers !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_PASSWORD_RESET_TOKEN',
          message: 'The password reset link is invalid or expired.',
        });
      }

      const consumed = await tx.$executeRaw`
        UPDATE "auth_tokens"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "id" = CAST(${current.id} AS uuid)
          AND "consumedAt" IS NULL
      `;

      if (consumed !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_PASSWORD_RESET_TOKEN',
          message: 'The password reset link is invalid or expired.',
        });
      }

      await tx.$executeRaw`
        UPDATE "auth_tokens"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = CAST(${current.userId} AS uuid)
          AND "type" = ${'PasswordReset'}
          AND "consumedAt" IS NULL
      `;
    });
  }

  async requestEmailVerification(
    data: RequestEmailVerificationDto,
    ip?: string,
  ): Promise<AuthActionResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();
    await this.enforcePublicAuthRateLimit(
      normalizedEmail,
      ip,
      'Maximum email-verification requests for this account exceeded',
    );
    const users = await this.prisma.$queryRaw<
      Array<{ id: string; organizationId: string; emailVerifiedAt: Date | null }>
    >`
      SELECT "id", "organizationId", "emailVerifiedAt"
      FROM "users"
      WHERE "emailNormalized" = ${normalizedEmail}
        AND "status" = ${'Active'}
      LIMIT 1
    `;

    const user = users[0];

    if (!user || user.emailVerifiedAt) {
      return { ...GENERIC_RECOVERY_RESPONSE, delivery: this.deliveryStatus() };
    }

    return this.issueToken(
      user.id,
      user.organizationId,
      'EmailVerification',
      RECOVERY_TTL_HOURS,
    );
  }

  async completeEmailVerification(data: CompleteEmailVerificationDto, ip?: string): Promise<void> {
    await this.enforcePublicAuthRateLimit(
      `token-complete:${ip ?? 'unknown'}`,
      undefined,
      'Maximum email-verification completion attempts from this source exceeded',
    );
    const tokenHash = this.hashToken(data.token);

    await this.prisma.$transaction(async (tx) => {
      const token = await tx.$queryRaw<AuthTokenRow[]>`
        SELECT t."id", t."userId", t."organizationId", t."expiresAt"
        FROM "auth_tokens" t
        INNER JOIN "users" u ON u."id" = t."userId" AND u."organizationId" = t."organizationId"
        WHERE t."tokenHash" = ${tokenHash}
          AND t."type" = ${'EmailVerification'}
          AND t."consumedAt" IS NULL
          AND t."expiresAt" > CURRENT_TIMESTAMP
          AND u."status" = ${'Active'}
        FOR UPDATE
      `;

      const current = token[0];
      if (!current) {
        throw new UnauthorizedException({
          code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
          message: 'The email verification link is invalid or expired.',
        });
      }

      const updatedUsers = await tx.$executeRaw`
        UPDATE "users"
        SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = CAST(${current.userId} AS uuid)
          AND "organizationId" = CAST(${current.organizationId} AS uuid)
          AND "status" = ${'Active'}
      `;

      if (updatedUsers !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
          message: 'The email verification link is invalid or expired.',
        });
      }

      const consumed = await tx.$executeRaw`
        UPDATE "auth_tokens"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "id" = CAST(${current.id} AS uuid)
          AND "consumedAt" IS NULL
      `;

      if (consumed !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
          message: 'The email verification link is invalid or expired.',
        });
      }
    });
  }

  async createInvitation(
    organizationId: string,
    email: string,
    displayName: string,
    roleIds: string[] = [],
  ): Promise<InvitationResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { organizationId, emailNormalized: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'A user with this email already exists in the organization.',
      });
    }

    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: {
          id: { in: uniqueRoleIds },
          status: 'Active',
          OR: [{ organizationId: null }, { organizationId }],
        },
        select: { id: true },
      });
      if (roles.length !== uniqueRoleIds.length) {
        throw new BadRequestException({
          code: 'INVALID_INVITATION_ROLES',
          message: 'One or more selected roles are unavailable.',
        });
      }
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId,
          email: email.trim(),
          emailNormalized: normalizedEmail,
          displayName: displayName.trim(),
          status: 'Invited',
        },
        select: { id: true, email: true, displayName: true },
      });

      if (uniqueRoleIds.length > 0) {
        await tx.userRole.createMany({
          data: uniqueRoleIds.map((roleId) => ({ userId: user.id, roleId })),
          skipDuplicates: true,
        });
      }

      await tx.$executeRaw`
        INSERT INTO "auth_tokens" (
          "id", "organizationId", "userId", "type", "tokenHash", "expiresAt"
        ) VALUES (
          CAST(${randomUUID()} AS uuid),
          CAST(${organizationId} AS uuid),
          CAST(${user.id} AS uuid),
          ${'Invitation'},
          ${tokenHash},
          ${expiresAt}
        )
      `;

      await this.queueAuthEmail(
        tx,
        'Invitation',
        user.email,
        user.displayName,
        rawToken,
        expiresAt,
        organizationId,
      );

      return user;
    });

    const exposeDevToken = this.canExposeDevelopmentTokens();
    return {
      id: invitation.id,
      email: invitation.email,
      displayName: invitation.displayName,
      expiresAt: expiresAt.toISOString(),
      delivery: exposeDevToken ? 'development' : 'queued',
      ...(exposeDevToken ? { devToken: rawToken } : {}),
    };
  }

  async acceptInvitation(data: AcceptInvitationDto, ip?: string): Promise<void> {
    await this.enforcePublicAuthRateLimit(
      `invitation-accept:${ip ?? 'unknown'}`,
      undefined,
      'Maximum invitation-acceptance attempts from this source exceeded',
    );
    const tokenHash = this.hashToken(data.token);
    const passwordHash = await bcrypt.hash(data.password, 10);

    await this.prisma.$transaction(async (tx) => {
      const token = await tx.$queryRaw<(AuthTokenRow & { displayName: string })[]>`
        SELECT t."id", t."userId", t."organizationId", t."expiresAt", u."displayName"
        FROM "auth_tokens" t
        INNER JOIN "users" u ON u."id" = t."userId" AND u."organizationId" = t."organizationId"
        WHERE t."tokenHash" = ${tokenHash}
          AND t."type" = ${'Invitation'}
          AND t."consumedAt" IS NULL
          AND t."expiresAt" > CURRENT_TIMESTAMP
          AND u."status" = ${'Invited'}
        FOR UPDATE
      `;

      const current = token[0];
      if (!current) {
        throw new UnauthorizedException({
          code: 'INVALID_INVITATION_TOKEN',
          message: 'The invitation link is invalid or expired.',
        });
      }

      const updatedUsers = await tx.$executeRaw`
        UPDATE "users"
        SET "passwordHash" = ${passwordHash},
            "displayName" = ${data.displayName?.trim() || current.displayName},
            "status" = ${'Active'},
            "emailVerifiedAt" = CURRENT_TIMESTAMP,
            "invitationAcceptedAt" = CURRENT_TIMESTAMP,
            "tokenVersion" = "tokenVersion" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = CAST(${current.userId} AS uuid)
          AND "organizationId" = CAST(${current.organizationId} AS uuid)
          AND "status" = ${'Invited'}
      `;

      if (updatedUsers !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_INVITATION_TOKEN',
          message: 'The invitation link is invalid or expired.',
        });
      }

      const consumed = await tx.$executeRaw`
        UPDATE "auth_tokens"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "id" = CAST(${current.id} AS uuid)
          AND "consumedAt" IS NULL
      `;

      if (consumed !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_INVITATION_TOKEN',
          message: 'The invitation link is invalid or expired.',
        });
      }
    });
  }

  private canExposeDevelopmentTokens(): boolean {
    const nodeEnv = process.env.NODE_ENV ?? this.configService.get<string>('NODE_ENV', 'development');
    const expose = process.env.AUTH_EXPOSE_DEV_TOKENS
      ?? this.configService.get<string>('AUTH_EXPOSE_DEV_TOKENS');
    return nodeEnv !== 'production' && expose === 'true';
  }

  private deliveryStatus(): AuthDeliveryStatus {
    // A real token is always persisted and queued for a known account. The
    // development token is only an optional local verification aid.
    return this.canExposeDevelopmentTokens() ? 'development' : 'queued';
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /** Enqueue the transactional email for an auth token inside the caller's
   *  transaction, so the outbox row commits atomically with the token. */
  private async queueAuthEmail(
    tx: Prisma.TransactionClient,
    type: AuthTokenType,
    toEmail: string,
    displayName: string,
    rawToken: string,
    expiresAt: Date,
    organizationId: string,
  ): Promise<void> {
    const template =
      type === 'PasswordReset'
        ? 'password_reset'
        : type === 'EmailVerification'
          ? 'email_verification'
          : 'invitation';
    const subject =
      template === 'password_reset'
        ? 'Reset your RecruitFlow password'
        : template === 'email_verification'
          ? 'Verify your email address'
          : "You're invited to join RecruitFlow";
    await this.emailOutbox.enqueueWithTx(tx, {
      organizationId,
      toEmail,
      subject,
      template,
      payload: {
        token: rawToken,
        displayName,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  private async issueToken(
    userId: string,
    organizationId: string,
    type: AuthTokenType,
    ttlHours: number,
  ): Promise<AuthActionResponse> {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "auth_tokens"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = CAST(${userId} AS uuid)
          AND "type" = ${type}
          AND "consumedAt" IS NULL
      `;
      await tx.$executeRaw`
        INSERT INTO "auth_tokens" (
          "id", "organizationId", "userId", "type", "tokenHash", "expiresAt"
        ) VALUES (
          CAST(${randomUUID()} AS uuid),
          CAST(${organizationId} AS uuid),
          CAST(${userId} AS uuid),
          ${type},
          ${tokenHash},
          ${expiresAt}
        )
      `;

      const recipient = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, displayName: true },
      });
      if (recipient) {
        await this.queueAuthEmail(
          tx,
          type,
          recipient.email,
          recipient.displayName,
          rawToken,
          expiresAt,
          organizationId,
        );
      }
    });

    const exposeDevToken = this.canExposeDevelopmentTokens();
    return {
      accepted: true,
      delivery: exposeDevToken ? 'development' : 'queued',
      ...(exposeDevToken ? { expiresAt: expiresAt.toISOString() } : {}),
      ...(exposeDevToken ? { devToken: rawToken } : {}),
    };
  }
}
