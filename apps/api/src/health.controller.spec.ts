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

  it('requires a fresh worker heartbeat when production readiness enables it', async () => {
    const previousRequired = process.env.WORKER_READINESS_REQUIRED;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.WORKER_READINESS_REQUIRED = 'true';
    process.env.NODE_ENV = 'production';
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      organization: { findFirst: vi.fn().mockResolvedValue(null) },
      serviceHeartbeat: {
        findUnique: vi.fn().mockResolvedValue({ status: 'healthy', observedAt: new Date() }),
      },
    };
    const controller = new HealthController(database as unknown as PrismaService);

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'up',
      services: { database: 'connected', worker: 'connected' },
    });

    if (previousRequired === undefined) delete process.env.WORKER_READINESS_REQUIRED;
    else process.env.WORKER_READINESS_REQUIRED = previousRequired;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it('reports the API as unavailable when the required worker heartbeat is stale', async () => {
    const previousRequired = process.env.WORKER_READINESS_REQUIRED;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.WORKER_READINESS_REQUIRED = 'true';
    process.env.NODE_ENV = 'production';
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      organization: { findFirst: vi.fn().mockResolvedValue(null) },
      serviceHeartbeat: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'healthy',
          observedAt: new Date(Date.now() - 120_000),
        }),
      },
    };
    const controller = new HealthController(database as unknown as PrismaService);

    await expect(controller.getReadiness()).rejects.toMatchObject({
      status: 503,
      response: { services: { database: 'connected', worker: 'stale' } },
    });

    if (previousRequired === undefined) delete process.env.WORKER_READINESS_REQUIRED;
    else process.env.WORKER_READINESS_REQUIRED = previousRequired;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });
});
