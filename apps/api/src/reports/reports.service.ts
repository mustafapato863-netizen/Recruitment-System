import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { ReportKpis, FunnelStage, DepartmentHiring, RecruiterWorkload } from '@recruitflow/contracts';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(organizationId: string): Promise<ReportKpis> {
    const [applications, offers, interviews, joinedCases] = await Promise.all([
      this.prisma.application.findMany({
        where: { organizationId },
        select: { source: true, stage: true, createdAt: true },
      }),
      this.prisma.offer.findMany({
        where: { organizationId },
        select: {
          status: true,
          createdAt: true,
          application: { select: { createdAt: true } },
        },
      }),
      this.prisma.interview.findMany({
        where: { organizationId },
        select: { status: true },
      }),
      this.prisma.hiringCase.findMany({
        where: { organizationId, status: 'Joined' },
        select: {
          actualJoiningDate: true,
          createdAt: true,
          application: { select: { vacancy: { select: { branchId: true } } } },
        },
      }),
    ]);

    const totalOffers = offers.length;
    const acceptedOffers = offers.filter((offer) => offer.status === 'Accepted').length;
    const noShows = interviews.filter((interview) => interview.status === 'No-show').length;
    const completedInterviews = interviews.filter((interview) =>
      ['Completed', 'No-show'].includes(interview.status),
    ).length;
    const averageTimeToFill = joinedCases.length === 0
      ? 0
      : Math.round(
          joinedCases.reduce((sum, item) => {
            const end = item.actualJoiningDate ?? item.createdAt;
            return sum + (end.getTime() - item.createdAt.getTime()) / 86_400_000;
          }, 0) / joinedCases.length,
        );
    const averageTimeToOffer = offers.length === 0
      ? 0
      : Math.round(
          offers.reduce((sum, offer) => sum + (offer.createdAt.getTime() - offer.application.createdAt.getTime()) / 86_400_000, 0) / offers.length,
        );

    const sourceCounts = new Map<string, { total: number; joined: number }>();
    for (const application of applications) {
      const source = application.source?.trim() || 'Unknown';
      const current = sourceCounts.get(source) ?? { total: 0, joined: 0 };
      current.total += 1;
      if (application.stage === 'Joined') current.joined += 1;
      sourceCounts.set(source, current);
    }
    const topSourceEntry = [...sourceCounts.entries()].sort((a, b) => b[1].total - a[1].total)[0];

    return {
      timeToFill: { value: averageTimeToFill, change: 0 },
      timeToOffer: { value: averageTimeToOffer, target: 25 },
      offerAcceptanceRate: {
        value: totalOffers === 0 ? 0 : Math.round((acceptedOffers / totalOffers) * 100),
        accepted: acceptedOffers,
        total: totalOffers,
      },
      interviewNoShowRate: {
        value: completedInterviews === 0 ? 0 : Math.round((noShows / completedInterviews) * 100),
        noShows,
        total: completedInterviews,
      },
      topSource: {
        name: topSourceEntry?.[0] ?? 'No data',
        conversionRate: topSourceEntry && topSourceEntry[1].total > 0
          ? Math.round((topSourceEntry[1].joined / topSourceEntry[1].total) * 100)
          : 0,
      },
      totalJoined: {
        count: joinedCases.length,
        branches: new Set(joinedCases.map((item) => item.application.vacancy.branchId)).size,
      },
    };
  }

  async getFunnel(organizationId: string): Promise<FunnelStage[]> {
    const grouped = await this.prisma.application.groupBy({
      by: ['stage'],
      where: { organizationId },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((item) => [item.stage, item._count._all]));
    const applied = counts.get('Applied') ?? 0;
    const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];
    return stages.map((name) => ({
      name,
      count: counts.get(name) ?? 0,
      percent: applied === 0 ? 0 : Math.round(((counts.get(name) ?? 0) / applied) * 100),
    }));
  }

  async getHiringByDepartment(organizationId: string): Promise<DepartmentHiring[]> {
    const vacancies = await this.prisma.vacancy.findMany({
      where: { organizationId },
      select: {
        approvedHeadcount: true,
        position: { select: { title: true } },
        applications: { select: { hiringCase: { select: { status: true } } } },
      },
    });
    const grouped = new Map<string, { target: number; joined: number }>();
    for (const vacancy of vacancies) {
      const department = vacancy.position.title;
      const current = grouped.get(department) ?? { target: 0, joined: 0 };
      current.target += vacancy.approvedHeadcount;
      current.joined += vacancy.applications.filter((application) => application.hiringCase?.status === 'Joined').length;
      grouped.set(department, current);
    }
    return [...grouped.entries()].map(([department, values]) => ({ department, ...values }));
  }

  async getRecruiterWorkload(organizationId: string): Promise<RecruiterWorkload[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'Active' },
      select: {
        displayName: true,
        _count: { select: { primaryApplications: true, assignments: true } },
      },
    });
    return users.map((user) => ({
      name: user.displayName,
      vacancies: user._count.assignments,
      applications: user._count.primaryApplications,
      overdueTasks: 0,
    }));
  }
}
