import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit.service';
import type { PrismaService } from '../../database/prisma.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  auditLog: {
    findMany: MockFn;
    count: MockFn;
  };
  user: {
    findMany: MockFn;
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    };
    service = new AuditService(mockPrisma as PrismaService);
  });

  it('resolves actor display names within the requested organization', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        organizationId: 'org-1',
        actorUserId: 'user-1',
        action: 'USER_CREATE',
        entityType: 'system',
        entityId: 'system',
        result: 'SUCCESS',
        reason: null,
        correlationId: null,
        ipAddress: null,
        createdAt: new Date('2026-09-10T10:00:00Z'),
      },
      {
        id: 'log-2',
        organizationId: 'org-1',
        actorUserId: 'deleted-user',
        action: 'USER_DELETE',
        entityType: 'system',
        entityId: 'system',
        result: 'SUCCESS',
        reason: null,
        correlationId: null,
        ipAddress: null,
        createdAt: new Date('2026-09-10T09:00:00Z'),
      },
    ]);
    mockPrisma.auditLog.count.mockResolvedValue(2);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', displayName: 'Sara Ahmed' }]);

    const result = await service.query('org-1');

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', id: { in: ['user-1', 'deleted-user'] } },
      select: { id: true, displayName: true },
    });
    expect(result.data[0].actorDisplayName).toBe('Sara Ahmed');
    expect(result.data[1].actorDisplayName).toBeUndefined();
  });

  it('does not query users when all events are system events', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        organizationId: null,
        actorUserId: null,
        action: 'PUBLIC_APPLICATION_CREATE',
        entityType: 'application',
        entityId: 'app-1',
        result: 'SUCCESS',
        reason: null,
        correlationId: null,
        ipAddress: null,
        createdAt: new Date('2026-09-10T10:00:00Z'),
      },
    ]);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const result = await service.query('org-1');

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(result.data[0].actorDisplayName).toBeUndefined();
  });
});
