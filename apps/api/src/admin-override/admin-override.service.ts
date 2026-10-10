import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { VacancyCoreService } from '../vacancy-core/vacancy-core.service';

/**
 * B9 / A5: admin override. The only way an Administrator changes owned work.
 * job.hold / job.reopen / job.close go through B3's lifecycle (VacancyCoreService.overrideJobStatus, B2F-4): same
 * transition table, hold/close reason lists and status history as the owner's path, past the owner check, with the
 * ADMIN_OVERRIDE audit row written in the same transaction.
 * Reason: hold/close take a list value (hold-reasons / close-reasons; "Other" + note). For the v2 drawer, free text of
 * 10+ characters that isn't a list value is stored as "Other: <text>". Reopen keeps free text (10+ characters).
 * file.reassign is POST /admin/overrides/file-reassign (B7 ReassignService.adminOverride); it is refused here.
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

  async override(user: AuthUser, body: { action?: string; entityId?: string; reason?: string; note?: string; holdUntil?: string }) {
    if (!user.roleCodes.includes('ADMINISTRATOR')) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an administrator can use an override.' });
    const reason = body.reason?.trim() ?? '';
    if (!reason) throw new BadRequestException({ code: 'OVERRIDE_REASON_REQUIRED', field: 'reason', message: 'An override needs a reason.' });
    if ((DEFERRED_OVERRIDE_ACTIONS as readonly string[]).includes(body.action ?? '')) {
      throw new BadRequestException({ code: 'OVERRIDE_NOT_ALLOWED', message: 'file.reassign is not taken here: use POST /admin/overrides/file-reassign (B7 reassign, audited).' });
    }
    const rule = OVERRIDE_ACTIONS[body.action as OverrideAction];
    if (!rule) throw new BadRequestException({ code: 'OVERRIDE_NOT_ALLOWED', message: `Allowed override actions: ${Object.keys(OVERRIDE_ACTIONS).join(', ')}.` });
    const job = await this.prisma.vacancy.findFirst({ where: { id: body.entityId ?? '', organizationId: user.organizationId }, select: { id: true, status: true, vacancyCode: true } });
    if (!job) throw new NotFoundException('Job not found.');
    if (!(rule.from as readonly string[]).includes(job.status)) {
      throw new ConflictException({ code: 'OVERRIDE_NOT_ALLOWED', message: `${body.action} is not allowed from ${job.status}.` });
    }
    const verb = (body.action ?? '').slice(4) as 'hold' | 'reopen' | 'close';
    const updated = await this.runOverride(user, job.id, verb, reason, body);
    return { action: body.action, entityId: job.id, from: job.status, to: updated.status, reason };
  }

  private async runOverride(user: AuthUser, jobId: string, verb: 'hold' | 'reopen' | 'close', reason: string, body: { note?: string; holdUntil?: string }) {
    const run = (r: string, note?: string) => this.vacancies.overrideJobStatus(jobId, user.organizationId, user, verb, r, { note: note ?? null, holdUntil: body.holdUntil ?? null });
    const freeText = () => { if (reason.length < 10) throw new BadRequestException({ code: 'OVERRIDE_REASON_REQUIRED', field: 'reason', message: 'Pick a reason from the list, or give at least 10 characters.' }); };
    if (verb === 'reopen') { freeText(); return run(reason); }
    try {
      return await run(reason, body.note);
    } catch (e) {
      // v2 drawer compatibility: free text that isn't a list value is recorded as "Other: <text>".
      if ((e as { response?: { code?: string } }).response?.code === 'REASON_NOT_IN_LIST') { freeText(); return run('Other', reason); }
      throw e;
    }
  }
}
