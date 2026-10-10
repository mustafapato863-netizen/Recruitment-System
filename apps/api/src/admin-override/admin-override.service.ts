import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { VacancyCoreService } from '../vacancy-core/vacancy-core.service';

/**
 * B9 / A5: admin override. The only way an Administrator changes owned work.
 * Covered actions (on this base): job.hold, job.reopen. Each needs a reason (>= 10 chars) and writes
 * an ADMIN_OVERRIDE audit row (who, when, action, reason, before/after) in the same request.
 * TODO(B3): once the B3 hold/reopen endpoints are on this stack, route these through them (status history + holdUntil).
 */
export const OVERRIDE_ACTIONS = {
  'job.hold': { from: ['Open', 'Partially Filled'], to: 'On Hold' },
  'job.reopen': { from: ['On Hold'], to: 'Open' },
} as const;
export type OverrideAction = keyof typeof OVERRIDE_ACTIONS;

@Injectable()
export class AdminOverrideService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(VacancyCoreService) private readonly vacancies: VacancyCoreService,
  ) {}

  async override(user: AuthUser, body: { action?: string; entityId?: string; reason?: string }) {
    if (!user.roleCodes.includes('ADMINISTRATOR')) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an administrator can use an override.' });
    const reason = body.reason?.trim() ?? '';
    if (reason.length < 10) throw new BadRequestException({ code: 'OVERRIDE_REASON_REQUIRED', message: 'An override needs a reason (at least 10 characters).' });
    const rule = OVERRIDE_ACTIONS[body.action as OverrideAction];
    if (!rule) throw new BadRequestException({ code: 'OVERRIDE_NOT_ALLOWED', message: `Allowed override actions: ${Object.keys(OVERRIDE_ACTIONS).join(', ')}.` });
    const job = await this.prisma.vacancy.findFirst({ where: { id: body.entityId ?? '', organizationId: user.organizationId }, select: { id: true, status: true, vacancyCode: true } });
    if (!job) throw new NotFoundException('Job not found.');
    if (!(rule.from as readonly string[]).includes(job.status)) {
      throw new ConflictException({ code: 'OVERRIDE_NOT_ALLOWED', message: `${body.action} is not allowed from ${job.status}.` });
    }
    const updated = await this.vacancies.updateVacancyStatus(job.id, user.organizationId, rule.to as never);
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId, actorUserId: user.userId, action: 'ADMIN_OVERRIDE', entityType: 'Vacancy', entityId: job.id,
        result: 'Success', reason, beforeData: { action: body.action, status: job.status }, afterData: { action: body.action, status: rule.to },
      },
    });
    return { action: body.action, entityId: job.id, from: job.status, to: updated.status, reason };
  }
}
