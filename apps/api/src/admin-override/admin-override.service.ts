import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { VacancyCoreService } from '../vacancy-core/vacancy-core.service';

/**
 * B9 / A5: admin override. The only way an Administrator changes owned work.
 * Covered actions: job.hold, job.reopen, job.close; file.reassign is recognised but deferred (see below). Each needs a reason (>= 10 chars) and writes
 * an ADMIN_OVERRIDE audit row (who, when, action, reason, before/after) in the same request.
 * Deferred to stacking (B3 is not on #21's base, #13 → main):
 *   TODO(B3): route hold/reopen/close through B3's job lifecycle service so they also write vacancy_status_histories,
 *   take holdUntil, validate the reason against hold-reasons / close-reasons, and run the transition table.
 *   Until then they use VacancyCoreService.updateVacancyStatus + the ADMIN_OVERRIDE audit row.
 *   TODO(B7): file.reassign → B7 ReassignService (manager reassign rules, history, notifications). Returns 400 here.
 */
export const OVERRIDE_ACTIONS = {
  'job.hold': { from: ['Open', 'Partially Filled'], to: 'On Hold' },
  'job.reopen': { from: ['On Hold'], to: 'Open' },
  'job.close': { from: ['Open', 'On Hold', 'Partially Filled', 'Filled'], to: 'Closed' },
} as const;
export const DEFERRED_OVERRIDE_ACTIONS = ['file.reassign'] as const;
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
    if ((DEFERRED_OVERRIDE_ACTIONS as readonly string[]).includes(body.action ?? '')) {
      throw new BadRequestException({ code: 'OVERRIDE_NOT_ALLOWED', message: 'file.reassign override is not available on this build yet (needs B7 reassign). Use the manager reassign once B7 is merged.' });
    }
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
