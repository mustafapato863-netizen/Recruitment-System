import { HttpException, Injectable, Logger } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@recruitflow/database';
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { createHash } from 'node:crypto';

export interface RateLimitStatus {
  isLocked: boolean;
  attemptsLeft: number;
  lockedUntil?: Date | null;
  retryAfterSeconds?: number;
}

type RateLimitScope = 'account' | 'ip';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private getConfig() {
    const maxAttempts = this.configService.get<number>('AUTH_MAX_ATTEMPTS', 5);
    const ipMaxAttempts = this.configService.get<number>('AUTH_IP_MAX_ATTEMPTS', 25);
    const lockoutDuration = this.configService.get<number>('AUTH_LOCKOUT_DURATION', 15 * 60);
    const windowDuration = this.configService.get<number>('AUTH_WINDOW_DURATION', 5 * 60);
    return { maxAttempts, ipMaxAttempts, lockoutDuration, windowDuration };
  }

  private normalizeIdentifier(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  private hashKey(scope: RateLimitScope, key: string): string {
    return createHash('sha256').update(`${scope}:${key}`).digest('hex');
  }

  private statusFromRecord(
    record: { attempts: number; lastAttemptAt: Date; lockedUntil: Date | null } | null,
    maxAttempts: number,
    windowDuration: number,
    now: Date,
  ): RateLimitStatus {
    if (!record || now.getTime() > record.lastAttemptAt.getTime() + windowDuration * 1000) {
      return { isLocked: false, attemptsLeft: maxAttempts };
    }

    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        isLocked: true,
        attemptsLeft: 0,
        lockedUntil: record.lockedUntil,
        retryAfterSeconds: Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000),
      };
    }

    return {
      isLocked: false,
      attemptsLeft: Math.max(0, maxAttempts - record.attempts),
    };
  }

  private async getStatus(
    scope: RateLimitScope,
    key: string,
    maxAttempts: number,
    now: Date,
  ): Promise<RateLimitStatus> {
    const { windowDuration } = this.getConfig();
    const keyHash = this.hashKey(scope, key);
    const record = await this.prisma.authRateLimit.findUnique({
      where: { scope_keyHash: { scope, keyHash } },
      select: { attempts: true, lastAttemptAt: true, lockedUntil: true },
    });
    const status = this.statusFromRecord(record, maxAttempts, windowDuration, now);

    if (record && !status.isLocked && (status.attemptsLeft === maxAttempts || (record.lockedUntil && now >= record.lockedUntil))) {
      await this.prisma.authRateLimit.deleteMany({ where: { scope, keyHash } });
    }

    return status;
  }

  async checkLimit(identifier: string, ip?: string): Promise<RateLimitStatus> {
    const accountKey = this.normalizeIdentifier(identifier);
    const { maxAttempts, ipMaxAttempts } = this.getConfig();
    const now = new Date();

    const accountStatus = await this.getStatus('account', accountKey, maxAttempts, now);
    if (accountStatus.isLocked) return accountStatus;

    if (ip) {
      const ipStatus = await this.getStatus('ip', ip.trim(), ipMaxAttempts, now);
      if (ipStatus.isLocked) return ipStatus;
    }

    return accountStatus;
  }

  async recordFailure(
    identifier: string,
    ip?: string,
    organizationId?: string,
    reason = 'Maximum consecutive failed login attempts exceeded',
  ): Promise<RateLimitStatus> {
    const accountKey = this.normalizeIdentifier(identifier);
    const { maxAttempts, ipMaxAttempts, lockoutDuration, windowDuration } = this.getConfig();
    const now = new Date();

    const recorded = await this.prisma.$transaction(async (tx) => {
      const recordFailure = async (scope: RateLimitScope, key: string, limit: number) => {
        const keyHash = this.hashKey(scope, key);
        const existing = await tx.authRateLimit.findUnique({
          where: { scope_keyHash: { scope, keyHash } },
          select: { attempts: true, lastAttemptAt: true },
        });
        const isExpired = existing && now.getTime() > existing.lastAttemptAt.getTime() + windowDuration * 1000;
        const attempts = (isExpired ? 0 : existing?.attempts ?? 0) + 1;
        const lockedUntil = attempts >= limit ? new Date(now.getTime() + lockoutDuration * 1000) : null;

        await tx.authRateLimit.upsert({
          where: { scope_keyHash: { scope, keyHash } },
          create: { scope, keyHash, attempts, lastAttemptAt: now, lockedUntil },
          update: { attempts, lastAttemptAt: now, lockedUntil },
        });

        return { attempts, lockedUntil };
      };

      const account = await recordFailure('account', accountKey, maxAttempts);
      if (ip) await recordFailure('ip', ip.trim(), ipMaxAttempts);

      return {
        accountLocked: account.attempts >= maxAttempts,
        accountLockedUntil: account.lockedUntil,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (recorded.accountLocked) {
      this.logger.warn(`Account rate limit lockout for [${accountKey}] from IP [${ip || 'unknown'}].`);
      try {
        let resolvedOrgId = organizationId;
        let resolvedUserId = 'system';

        if (!resolvedOrgId) {
          const user = await this.prisma.user.findFirst({
            where: { emailNormalized: accountKey },
            select: { id: true, organizationId: true },
          });
          if (user) {
            resolvedOrgId = user.organizationId;
            resolvedUserId = user.id;
          }
        }

        if (resolvedOrgId) {
          await this.prisma.auditLog.create({
            data: {
              organizationId: resolvedOrgId,
              entityType: 'AUTH',
              entityId: resolvedUserId,
              action: 'AUTH_LOCKOUT',
              result: 'LOCKED',
              reason,
              actorUserId: resolvedUserId !== 'system' ? resolvedUserId : null,
              ipAddress: ip || 'unknown',
              afterData: {
                identifier: accountKey,
                ip: ip || 'unknown',
                lockoutDurationSeconds: lockoutDuration,
                lockedUntil: recorded.accountLockedUntil?.toISOString(),
              },
            },
          });
        }
      } catch (auditErr) {
        this.logger.error('Failed to persist audit log for auth lockout', auditErr);
      }
    }

    return this.checkLimit(accountKey, ip);
  }

  async resetLimit(identifier: string, ip?: string): Promise<void> {
    const accountKey = this.normalizeIdentifier(identifier);
    const keys = [{ scope: 'account', keyHash: this.hashKey('account', accountKey) }];
    if (ip) keys.push({ scope: 'ip', keyHash: this.hashKey('ip', ip.trim()) });
    await this.prisma.authRateLimit.deleteMany({ where: { OR: keys } });
  }

  /** Consume the shared public-request budget for anonymous acquisition flows. */
  async enforcePublicRequestLimit(identifier: string, ip?: string, reason = 'Maximum public request volume exceeded'): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const status = await this.checkLimit(identifier, ip);
      if (status.isLocked) {
        throw this.publicRateLimitException(status.retryAfterSeconds);
      }
      try {
        const recorded = await this.recordFailure(identifier, ip, undefined, reason);
        if (recorded.isLocked) throw this.publicRateLimitException(recorded.retryAfterSeconds);
        return;
      } catch (error) {
        if (!isSerializationConflict(error) || attempt === 2) throw error;
      }
    }
  }

  private publicRateLimitException(retryAfterSeconds?: number): HttpException {
    return new HttpException(
      {
        statusCode: 429,
        code: 'RATE_LIMITED',
        error: 'Too Many Requests',
        message: 'Too many attempts. Please try again later.',
        retryable: true,
        retryAfterSeconds: retryAfterSeconds ?? null,
      },
      429,
    );
  }
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}
