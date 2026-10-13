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

  function futureToken() {
    return service.signPayload({
      applicationId: 'app-uuid-1',
      organizationId: 'org-uuid-1',
      title: 'Technical Assessment',
      interviewType: 'Technical',
      durationMinutes: 45,
      attendeeUserIds: ['user-1'],
      expiresAt: Date.now() + 3600_000,
      nonce: 'live-nonce',
    });
  }

  it('does not offer slots when the job is on hold', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      organizationId: 'org-uuid-1',
      candidate: { firstName: 'Phase', lastName: 'Eight', email: 'person@example.com' },
      vacancy: { status: 'On Hold', position: { title: 'Sample' } },
    });
    await expect(service.getInvitationView(futureToken())).rejects.toThrow(/on hold/i);
    expect(mockPrisma.interview.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.interview.create).not.toHaveBeenCalled();
  });

  it('does not book a slot when the job is closed', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      organizationId: 'org-uuid-1',
      candidate: { firstName: 'Phase', lastName: 'Eight', email: 'person@example.com' },
      vacancy: { status: 'Closed', position: { title: 'Sample' } },
    });
    await expect(service.bookSelfSchedule(futureToken(), {
      selectedSlot: new Date(Date.now() + 86_400_000).toISOString(),
      timezone: 'Asia/Riyadh',
    })).rejects.toThrow(/closed/i);
    expect(mockPrisma.interview.create).not.toHaveBeenCalled();
  });

  it('rejects an occupied interviewer slot', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      organizationId: 'org-uuid-1',
      candidate: { firstName: 'Phase', lastName: 'Eight', email: 'person@example.com' },
      vacancy: { status: 'Open', position: { title: 'Sample' } },
    });
    mockPrisma.interview.findMany.mockResolvedValue([{ id: 'busy' }]);
    await expect(service.bookSelfSchedule(futureToken(), {
      selectedSlot: new Date(Date.now() + 86_400_000).toISOString(),
      timezone: 'Asia/Riyadh',
    })).rejects.toThrow(/occupied/i);
    expect(mockPrisma.interview.create).not.toHaveBeenCalled();
  });

  it('records a booking receipt on the local test mailbox only', async () => {
    const previous = process.env.MAIL_DELIVERY_ENABLED;
    process.env.MAIL_DELIVERY_ENABLED = 'true';
    mockPrisma.application.findUnique.mockResolvedValue({
      organizationId: 'org-uuid-1',
      candidate: { firstName: 'Phase', lastName: 'Eight', email: 'person@example.com' },
      vacancy: { status: 'Open', position: { title: 'Sample' } },
    });
    mockPrisma.interview.findMany.mockResolvedValue([]);
    mockPrisma.interview.create.mockResolvedValue({
      id: 'int-1',
      interviewCode: 'INT-2026-008',
      title: 'Technical Assessment',
      scheduledStart: new Date('2026-11-02T06:00:00.000Z'),
      scheduledEnd: new Date('2026-11-02T06:45:00.000Z'),
      timezone: 'Asia/Riyadh',
      locationUrl: null,
    });
    try {
      await service.bookSelfSchedule(service.signPayload({
        applicationId: 'app-uuid-1',
        organizationId: 'org-uuid-1',
        title: 'Technical Assessment',
        interviewType: 'Technical',
        durationMinutes: 45,
        attendeeUserIds: [],
        expiresAt: Date.now() + 3600_000,
        nonce: 'mail-nonce',
      }), {
        selectedSlot: new Date(Date.now() + 86_400_000).toISOString(),
        timezone: 'Asia/Riyadh',
      });
      expect(mockPrisma.emailOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ toEmail: 'local-test@recruitflow.local' }),
      }));
      expect(JSON.stringify(mockPrisma.emailOutbox.create.mock.calls)).not.toContain('person@example.com');
    } finally {
      if (previous === undefined) delete process.env.MAIL_DELIVERY_ENABLED;
      else process.env.MAIL_DELIVERY_ENABLED = previous;
    }
  });
});
