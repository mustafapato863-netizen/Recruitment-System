import { describe, expect, it, vi } from 'vitest';
import { RolesService } from '../roles.service';
import type { PrismaService } from '../../database/prisma.service';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  permissions: [];
};

function createService(options: {
  sequence?: { lastIssued: number } | null;
  existingCodes?: string[];
  collisionCodes?: string[];
  transactionFailures?: unknown[];
}) {
  const now = new Date('2026-09-08T10:00:00.000Z');
  let persisted: RoleRow | null = null;
  const collisions = new Set(options.collisionCodes || []);
  const transactionFailures = [...(options.transactionFailures || [])];
  let sequence = options.sequence ?? null;

  const tx = {
    role: {
      findMany: vi.fn().mockResolvedValue((options.existingCodes || []).map((code) => ({ code }))),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { code?: string; id?: string } }) => {
        if (where.code) return Promise.resolve(collisions.has(where.code) ? { id: 'existing-role' } : null);
        return Promise.resolve(persisted);
      }),
      create: vi.fn().mockImplementation(({ data }: { data: Omit<RoleRow, 'id' | 'createdAt' | 'updatedAt' | 'permissions'> }) => {
        persisted = {
          ...data,
          id: 'new-role-id',
          createdAt: now,
          updatedAt: now,
          permissions: [],
        };
        return Promise.resolve(persisted);
      }),
    },
    codeSequence: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(sequence)),
      create: vi.fn().mockImplementation(({ data }: { data: { key: string; lastIssued: number } }) => {
        sequence = { lastIssued: data.lastIssued };
        return Promise.resolve({ ...data, createdAt: now, updatedAt: now });
      }),
      update: vi.fn().mockImplementation(({ data }: { data: { lastIssued: { increment: number } } }) => {
        sequence = { lastIssued: (sequence?.lastIssued || 0) + data.lastIssued.increment };
        return Promise.resolve({ key: 'ROLE', ...sequence, createdAt: now, updatedAt: now });
      }),
    },
  };

  const prisma = {
    ...tx,
    integration: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      const failure = transactionFailures.shift();
      if (failure) throw failure;
      return callback(tx);
    }),
  } as unknown as PrismaService;

  return { service: new RolesService(prisma), prisma, tx, getPersisted: () => persisted };
}

describe('RolesService automatic role codes', () => {
  it('allocates the next ROLE code from existing numeric role codes and ignores client code input', async () => {
    const { service, tx, getPersisted } = createService({
      existingCodes: ['ROLE_001', 'ROLE_007', 'ROLE_M1G4_1788164692002_ego1m_OrgB'],
    });

    const role = await service.create('org-1', { code: 'DUPLICATE', name: 'Recruiting Operations' });

    expect(role.code).toBe('ROLE_008');
    expect(getPersisted()?.code).toBe('ROLE_008');
    expect(tx.codeSequence.create).toHaveBeenCalledWith({
      data: { key: 'ROLE', lastIssued: 8 },
    });
  });

  it('increments an existing sequence without reusing a deleted role code', async () => {
    const { service, tx } = createService({
      sequence: { lastIssued: 8 },
      collisionCodes: ['ROLE_009'],
    });

    const role = await service.create('org-1', { name: 'Talent Operations' });

    expect(role.code).toBe('ROLE_010');
    expect(tx.codeSequence.update).toHaveBeenCalledTimes(2);
  });

  it('retries a serialization conflict so concurrent creation remains safe', async () => {
    const { service, prisma } = createService({
      sequence: { lastIssued: 12 },
      transactionFailures: [{ code: 'P2034' }],
    });

    const role = await service.create('org-1', { name: 'Compliance Reviewer' });

    expect(role.code).toBe('ROLE_013');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
