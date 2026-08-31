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
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'down',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected',
        },
      });
    }
  }
}
