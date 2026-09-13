import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from './database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { Public } from './common/decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  getHealth(): { status: 'ok'; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'recruitflow-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('readiness')
  async getReadiness() {
    const workerRequired = isWorkerReadinessRequired();
    let databaseStatus: 'connected' | 'disconnected' = 'disconnected';
    let workerStatus: 'connected' | 'stale' | 'not_required' = workerRequired ? 'stale' : 'not_required';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      // A reachable server with no migrated tables is not ready to serve requests.
      await this.prisma.organization.findFirst({ select: { id: true } });
      databaseStatus = 'connected';

      if (workerRequired) {
        const heartbeat = await this.prisma.serviceHeartbeat.findUnique({
          where: { service: 'worker' },
          select: { status: true, observedAt: true },
        });
        const maxAgeMs = positiveInt(process.env.WORKER_HEARTBEAT_MAX_AGE_MS, 60_000, 15 * 60_000);
        const isFresh = heartbeat
          ? Date.now() - heartbeat.observedAt.getTime() <= maxAgeMs
          : false;
        if (!heartbeat || heartbeat.status !== 'healthy' || !isFresh) {
          throw new Error('Background worker heartbeat is stale or missing.');
        }
        workerStatus = 'connected';
      }

      return {
        status: 'up',
        timestamp: new Date().toISOString(),
        services: {
          database: databaseStatus,
          worker: workerStatus,
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'down',
        timestamp: new Date().toISOString(),
        services: {
          database: databaseStatus,
          worker: workerStatus,
        },
      });
    }
  }
}

function isWorkerReadinessRequired(): boolean {
  const configured = process.env.WORKER_READINESS_REQUIRED?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw ?? fallback);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(max, parsed)) : fallback;
}
