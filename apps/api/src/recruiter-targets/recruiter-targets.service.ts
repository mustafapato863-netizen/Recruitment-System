import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { UpsertRecruiterTargetDto, UpdateRecruiterTargetDto } from './recruiter-targets.dto';
import type { RecruiterTargetRecord, RecruiterTargetProgressRecord, RecruiterTargetActual } from '@recruitflow/contracts';

@Injectable()
export class RecruiterTargetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all active targets for an organization (Team Lead / Manager view) */
  async list(organizationId: string, period?: string): Promise<RecruiterTargetRecord[]> {
    const where: Record<string, unknown> = { organizationId, isActive: true };
    if (period === 'daily' || period === 'monthly') where['period'] = period;

    const targets = await this.prisma.recruiterTarget.findMany({
      where,
      include: {
        recruiter: { select: { id: true, displayName: true } },
        setBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ recruiter: { displayName: 'asc' } }, { period: 'asc' }],
    });

    return targets.map((t) => this.toRecord(t));
  }

  /** Get current user's own targets + live progress */
  async getMyProgress(organizationId: string, recruiterId: string): Promise<RecruiterTargetProgressRecord[]> {
    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-09"
    const targets = await this.prisma.recruiterTarget.findMany({
      where: {
        organizationId,
        recruiterId,
        isActive: true,
        OR: [
          { period: 'daily' },
          { period: 'monthly', month: currentMonth },
        ],
      },
      include: {
        recruiter: { select: { id: true, displayName: true } },
        setBy: { select: { id: true, displayName: true } },
      },
      orderBy: { period: 'asc' },
    });

    const results: RecruiterTargetProgressRecord[] = [];
    for (const target of targets) {
      const actual = await this.computeActual(organizationId, recruiterId, target.period as 'daily' | 'monthly');
      results.push({
        target: this.toRecord(target),
        actual,
      });
    }

    return results;
  }

  /** Create or update (upsert) a recruiter target */
  async upsert(organizationId: string, setById: string, dto: UpsertRecruiterTargetDto): Promise<RecruiterTargetRecord> {
    // Validate recruiter exists
    const recruiter = await this.prisma.user.findFirst({
      where: { id: dto.recruiterId, organizationId, status: 'Active' },
      select: { id: true },
    });
    if (!recruiter) throw new NotFoundException('Recruiter not found or inactive in this organization.');

    if (dto.period === 'monthly' && !dto.month) {
      throw new BadRequestException('Month is required for monthly targets (format: YYYY-MM).');
    }

    const month = dto.period === 'daily' ? null : (dto.month ?? null);

    const target = await this.prisma.recruiterTarget.upsert({
      where: {
        organizationId_recruiterId_period_month: {
          organizationId,
          recruiterId: dto.recruiterId,
          period: dto.period,
          month: month ?? '',
        },
      },
      update: {
        calls: dto.calls,
        screenings: dto.screenings,
        interviews: dto.interviews,
        offers: dto.offers,
        hires: dto.hires,
        cvSourced: dto.cvSourced,
        notes: dto.notes ?? null,
        setById,
        isActive: true,
      },
      create: {
        organizationId,
        recruiterId: dto.recruiterId,
        setById,
        period: dto.period,
        month,
        calls: dto.calls,
        screenings: dto.screenings,
        interviews: dto.interviews,
        offers: dto.offers,
        hires: dto.hires,
        cvSourced: dto.cvSourced,
        notes: dto.notes ?? null,
      },
      include: {
        recruiter: { select: { id: true, displayName: true } },
        setBy: { select: { id: true, displayName: true } },
      },
    });

    return this.toRecord(target);
  }

  /** Update a specific target */
  async update(organizationId: string, id: string, dto: UpdateRecruiterTargetDto): Promise<RecruiterTargetRecord> {
    const existing = await this.prisma.recruiterTarget.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Target not found.');

    const data: Record<string, unknown> = {};
    if (dto.calls !== undefined) data['calls'] = dto.calls;
    if (dto.screenings !== undefined) data['screenings'] = dto.screenings;
    if (dto.interviews !== undefined) data['interviews'] = dto.interviews;
    if (dto.offers !== undefined) data['offers'] = dto.offers;
    if (dto.hires !== undefined) data['hires'] = dto.hires;
    if (dto.cvSourced !== undefined) data['cvSourced'] = dto.cvSourced;
    if (dto.notes !== undefined) data['notes'] = dto.notes;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;

    const updated = await this.prisma.recruiterTarget.update({
      where: { id },
      data,
      include: {
        recruiter: { select: { id: true, displayName: true } },
        setBy: { select: { id: true, displayName: true } },
      },
    });

    return this.toRecord(updated);
  }

  /** Soft-delete (deactivate) a target */
  async deactivate(organizationId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.recruiterTarget.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Target not found.');

    await this.prisma.recruiterTarget.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  /** Compute actual progress for a recruiter for a given period */
  private async computeActual(
    organizationId: string,
    recruiterId: string,
    period: 'daily' | 'monthly',
  ): Promise<RecruiterTargetActual> {
    const now = new Date();
    let rangeStart: Date;

    if (period === 'daily') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const dateFilter = { gte: rangeStart, lte: now };

    // Run all queries in parallel
    const [callsCount, screeningsCount, interviewsCount, offersCount, hiresCount, cvSourcedCount] =
      await Promise.all([
        // Calls: screening logs created by this recruiter in the period
        this.prisma.screeningLog.count({
          where: { organizationId, screenerId: recruiterId, createdAt: dateFilter },
        }),
        // Screenings: applications moved past screening by this recruiter
        this.prisma.applicationStatusHistory.count({
          where: {
            changedById: recruiterId,
            toStage: { notIn: ['Applied', 'Screening'] },
            createdAt: dateFilter,
            application: { organizationId },
          },
        }),
        // Interviews: completed interviews where this recruiter is primary
        this.prisma.interview.count({
          where: {
            organizationId,
            status: 'Completed',
            application: {
              OR: [
                { primaryRecruiterId: recruiterId },
                { taskOwnerId: recruiterId },
              ],
            },
            updatedAt: dateFilter,
          },
        }),
        // Offers: offers created in the period for this recruiter's applications
        this.prisma.offer.count({
          where: {
            organizationId,
            createdAt: dateFilter,
            application: {
              OR: [
                { primaryRecruiterId: recruiterId },
                { taskOwnerId: recruiterId },
              ],
            },
          },
        }),
        // Hires: applications reaching 'Joined' stage in the period
        this.prisma.applicationStatusHistory.count({
          where: {
            changedById: recruiterId,
            toStage: 'Joined',
            createdAt: dateFilter,
            application: { organizationId },
          },
        }),
        // CV Sourced: candidates created by this recruiter in the period
        this.prisma.candidate.count({
          where: { organizationId, createdById: recruiterId, createdAt: dateFilter },
        }),
      ]);

    return {
      calls: callsCount,
      screenings: screeningsCount,
      interviews: interviewsCount,
      offers: offersCount,
      hires: hiresCount,
      cvSourced: cvSourcedCount,
    };
  }

  private toRecord(t: {
    id: string;
    recruiterId: string;
    recruiter: { id: string; displayName: string };
    setById: string;
    setBy: { id: string; displayName: string };
    period: string;
    month: string | null;
    calls: number;
    screenings: number;
    interviews: number;
    offers: number;
    hires: number;
    cvSourced: number;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RecruiterTargetRecord {
    return {
      id: t.id,
      recruiterId: t.recruiterId,
      recruiterName: t.recruiter.displayName,
      setById: t.setById,
      setByName: t.setBy.displayName,
      period: t.period as 'daily' | 'monthly',
      month: t.month,
      calls: t.calls,
      screenings: t.screenings,
      interviews: t.interviews,
      offers: t.offers,
      hires: t.hires,
      cvSourced: t.cvSourced,
      notes: t.notes,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
