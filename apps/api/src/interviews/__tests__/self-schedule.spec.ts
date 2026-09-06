import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SelfScheduleService, type SelfScheduleTokenPayload } from '../self-schedule.service';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  application: { findUnique: MockFn };
  user: { findMany: MockFn };
  interview: { findFirst: MockFn; findMany: MockFn; create: MockFn };
  interviewAttendee: { createMany: MockFn };
  applicationNote: { create: MockFn };
  emailOutbox: { create: MockFn };
  codeSequence: { upsert: MockFn };
  $transaction: MockFn;
}

interface MockNotifications {
  create: MockFn;
}

describe('SelfScheduleService', () => {
  let service: SelfScheduleService;
  let mockPrisma: MockPrisma;
  let mockNotifications: MockNotifications;

  beforeEach(() => {
    mockPrisma = {
      application: { findUnique: vi.fn() },
      user: { findMany: vi.fn() },
      interview: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
      interviewAttendee: { createMany: vi.fn() },
      applicationNote: { create: vi.fn() },
      emailOutbox: { create: vi.fn() },
      codeSequence: { upsert: vi.fn().mockResolvedValue({ lastIssued: 5 }) },
      $transaction: vi.fn((cb: (tx: MockPrisma) => unknown) => cb(mockPrisma)),
    };

    mockNotifications = {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    service = new SelfScheduleService(
      mockPrisma as unknown as PrismaService,
      mockNotifications as unknown as NotificationsService,
    );
  });

  describe('HMAC Token signing & verification', () => {
    it('signs and verifies a valid self-schedule payload', () => {
      const payload: SelfScheduleTokenPayload = {
        applicationId: 'app-uuid-1',
        organizationId: 'org-uuid-1',
        title: 'Technical Assessment',
        interviewType: 'Technical',
        durationMinutes: 45,
        attendeeUserIds: ['user-1'],
        expiresAt: Date.now() + 3600 * 1000,
        nonce: 'abc123nonce',
      };

      const token = service.signPayload(payload);
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(2);

      const verified = service.verifyToken(token);
      expect(verified.applicationId).toBe('app-uuid-1');
      expect(verified.title).toBe('Technical Assessment');
      expect(verified.durationMinutes).toBe(45);
    });

    it('rejects a token with tampered payload', () => {
      const payload: SelfScheduleTokenPayload = {
        applicationId: 'app-uuid-1',
        organizationId: 'org-uuid-1',
        title: 'Technical Assessment',
        interviewType: 'Technical',
        durationMinutes: 45,
        attendeeUserIds: ['user-1'],
        expiresAt: Date.now() + 3600 * 1000,
        nonce: 'abc123nonce',
      };

      const token = service.signPayload(payload);
      const parts = token.split('.');
      // Tamper data part
      const tampered = `tampered${parts[0]}.${parts[1]}`;

      expect(() => service.verifyToken(tampered)).toThrow(BadRequestException);
    });

    it('rejects an expired self-schedule token', () => {
      const payload: SelfScheduleTokenPayload = {
        applicationId: 'app-uuid-1',
        organizationId: 'org-uuid-1',
        title: 'Technical Assessment',
        interviewType: 'Technical',
        durationMinutes: 45,
        attendeeUserIds: ['user-1'],
        expiresAt: Date.now() - 5000, // Expired 5 seconds ago
        nonce: 'abc123nonce',
      };

      const token = service.signPayload(payload);
      expect(() => service.verifyToken(token)).toThrow(/expired/i);
    });
  });
});
