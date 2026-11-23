import { describe, expect, it, vi, beforeAll } from 'vitest';

// See users-password.spec.ts: stub the ungenerated Prisma client entry so
// the import in prisma.service.ts resolves. The service under test receives
// a mocked PrismaService; this stub is never instantiated.
vi.mock('@recruitflow/database', () => ({
  PrismaClient: class MockPrismaClient {
    async $disconnect(): Promise<void> {}
  },
}));

import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import type { PrismaService } from '../../database/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { RateLimiterService } from '../rate-limiter.service';
import type { EmailOutboxService } from '../../email/email-outbox.service';

// Two accounts sharing one email in different orgs (the Abdelhakem case:
// an SGH account created first shadows a demo-org account with the same
// email). Each password must reach its own org's account.
const EMAIL = 'abdelhakem@saudigerman.com';
const SGH_ORG = 'org-sgh';
const DEMO_ORG = 'org-demo';
const SGH_PASSWORD = 'SghSecret1!';
const DEMO_PASSWORD = 'DemoTemp1!';

let sghHash = '';
let demoHash = '';

beforeAll(async () => {
  sghHash = await bcrypt.hash(SGH_PASSWORD, 10);
  demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
});

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: EMAIL,
    emailNormalized: EMAIL,
    passwordHash: sghHash,
    organizationId: SGH_ORG,
    status: 'Active',
    tokenVersion: 0,
    ...overrides,
  };
}

function createService(rows: Array<Record<string, unknown>>) {
  const findMany = vi.fn(async () => rows);
  const prisma = {
    user: { findMany },
  } as unknown as PrismaService;
  const service = new AuthService(
    prisma,
    {} as JwtService,
    {} as ConfigService,
    {} as RateLimiterService,
    {} as EmailOutboxService,
  );
  return { service, findMany };
}

describe('AuthService.validateUser (org-aware login)', () => {
  it('returns the demo-org account when the demo password is used, even though the SGH account was created first', async () => {
    const sgh = row({ id: 'sgh-user', organizationId: SGH_ORG, passwordHash: sghHash });
    const demo = row({ id: 'demo-user', organizationId: DEMO_ORG, passwordHash: demoHash });
    const { service, findMany } = createService([sgh, demo]);

    const result = await service.validateUser(EMAIL, DEMO_PASSWORD);

    expect(result?.id).toBe('demo-user');
    expect(result?.organizationId).toBe(DEMO_ORG);
    expect(findMany).toHaveBeenCalledWith({
      where: { emailNormalized: EMAIL },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns the SGH account when the SGH password is used', async () => {
    const sgh = row({ id: 'sgh-user', organizationId: SGH_ORG, passwordHash: sghHash });
    const demo = row({ id: 'demo-user', organizationId: DEMO_ORG, passwordHash: demoHash });
    const { service } = createService([sgh, demo]);

    const result = await service.validateUser(EMAIL, SGH_PASSWORD);

    expect(result?.id).toBe('sgh-user');
    expect(result?.organizationId).toBe(SGH_ORG);
  });

  it('returns null when the password matches neither account', async () => {
    const sgh = row({ id: 'sgh-user', organizationId: SGH_ORG, passwordHash: sghHash });
    const demo = row({ id: 'demo-user', organizationId: DEMO_ORG, passwordHash: demoHash });
    const { service } = createService([sgh, demo]);

    await expect(service.validateUser(EMAIL, 'NeitherPass1!')).resolves.toBeNull();
  });

  it('returns null when no account has that email', async () => {
    const { service } = createService([]);

    await expect(service.validateUser('nobody@sgh.com', 'Whatever1!')).resolves.toBeNull();
  });

  it('single-account login is unchanged: matching password returns the user, wrong password returns null', async () => {
    const { service } = createService([row()]);
    await expect(service.validateUser(EMAIL, SGH_PASSWORD)).resolves.toMatchObject({ id: 'user-1' });
    await expect(service.validateUser(EMAIL, 'WrongPass1!')).resolves.toBeNull();
  });

  it('skips accounts with no password set (e.g. invited, not yet accepted)', async () => {
    const invited = row({ id: 'invited-user', passwordHash: null });
    const active = row({ id: 'active-user', passwordHash: demoHash });
    const { service } = createService([invited, active]);

    const result = await service.validateUser(EMAIL, DEMO_PASSWORD);
    expect(result?.id).toBe('active-user');
  });

  it('normalizes the email before lookup', async () => {
    const { service, findMany } = createService([row()]);
    await service.validateUser('  ABDELHAKEM@Saudigerman.COM ', SGH_PASSWORD);
    expect(findMany).toHaveBeenCalledWith({
      where: { emailNormalized: EMAIL },
      orderBy: { createdAt: 'asc' },
    });
  });
});
