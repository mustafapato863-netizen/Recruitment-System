import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import type { PrismaService } from './database/prisma.service';

describe('deployment readiness', () => {
  it('rejects a reachable database without application tables', async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      organization: { findFirst: vi.fn().mockRejectedValue(new Error('Missing table')) },
    };
    const controller = new HealthController(database as unknown as PrismaService);
    await expect(controller.getReadiness()).rejects.toMatchObject({ status: 503 });
  });

  it('accepts a migrated database before business records are imported', async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      organization: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const controller = new HealthController(database as unknown as PrismaService);
    await expect(controller.getReadiness()).resolves.toMatchObject({ status: 'up' });
  });
});
