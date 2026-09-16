import { BadRequestException, HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import * as XLSX from 'xlsx';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { exportFailed } from '../common/errors/api-error';
import type { Prisma } from '@recruitflow/database';
import type {
  ReportKpis,
  FunnelStage,
  DepartmentHiring,
  RecruiterWorkload,
  ReportOverview,
  ReportTrendPoint,
  RecruitmentKpiItem,
} from '@recruitflow/contracts';
import type { AuthUser } from '@recruitflow/contracts';
import type { ReportOverviewQueryDto } from './reports.dto';

const DAY_MS = 86_400_000;

interface ResolvedReportRange {
  from: Date;
  to: Date;
  comparisonFrom: Date;
  comparisonTo: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(AccessControlService) private readonly accessControl?: AccessControlService,
  ) {}

  async getOverview(
    organizationId: string,
    query: ReportOverviewQueryDto,
    user?: AuthUser,
  ): Promise<ReportOverview> {
    const range = this.resolveRange(query);
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const applicationWhere = this.applicationWhere(organizationId, range.from, range.to, query, visibility);
    const comparisonApplicationWhere = this.applicationWhere(
      organizationId,
      range.comparisonFrom,
      range.comparisonTo,
      query,
      visibility,
    );

    const [
      applications,
      comparisonApplications,
      offers,
      comparisonOffers,
      interviews,
      comparisonInterviews,
      joinedCases,
      comparisonJoinedCases,
      vacancies,
      users,
      filterBranches,
      filterPositions,
      filterRecruiters,
    ] = await Promise.all([
      this.prisma.application.findMany({
        where: applicationWhere,
        select: { id: true, source: true, stage: true, appliedAt: true, createdAt: true },
      }),
      this.prisma.application.findMany({
        where: comparisonApplicationWhere,
        select: { id: true },
      }),
      this.prisma.offer.findMany({
        where: {
          organizationId,
          createdAt: { gte: range.from, lte: range.to },
          application: this.applicationRelationFilter(query, visibility),
        },
        select: {
          status: true,
          createdAt: true,
          application: { select: { appliedAt: true } },
        },
      }),
      this.prisma.offer.count({
        where: {
          organizationId,
          createdAt: { gte: range.comparisonFrom, lte: range.comparisonTo },
          application: this.applicationRelationFilter(query, visibility),
        },
      }),
      this.prisma.interview.findMany({
        where: {
          organizationId,
          scheduledStart: { gte: range.from, lte: range.to },
          application: this.applicationRelationFilter(query, visibility),
        },
        select: { status: true, scheduledStart: true },
      }),
      this.prisma.interview.count({
        where: {
          organizationId,
          scheduledStart: { gte: range.comparisonFrom, lte: range.comparisonTo },
          application: this.applicationRelationFilter(query, visibility),
        },
      }),
      this.prisma.hiringCase.findMany({
        where: {
          organizationId,
          status: 'Joined',
          actualJoiningDate: { gte: range.from, lte: range.to },
          application: this.applicationRelationFilter(query, visibility),
        },
        select: {
          actualJoiningDate: true,
          application: {
            select: {
              vacancy: { select: { branchId: true, openedAt: true, positionId: true } },
            },
          },
        },
      }),
      this.prisma.hiringCase.count({
        where: {
          organizationId,
          status: 'Joined',
          actualJoiningDate: { gte: range.comparisonFrom, lte: range.comparisonTo },
          application: this.applicationRelationFilter(query, visibility),
        },
      }),
      this.prisma.vacancy.findMany({
        where: {
          organizationId,
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.positionId ? { positionId: query.positionId } : {}),
          ...(user ? { applications: { some: visibility } } : {}),
        },
        select: {
          approvedHeadcount: true,
          positionId: true,
          position: { select: { title: true } },
          applications: {
            select: { hiringCase: { select: { status: true } } },
          },
        },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId,
          status: 'Active',
          ...(query.recruiterId ? { id: query.recruiterId } : {}),
        },
        select: {
          id: true,
          displayName: true,
          _count: {
            select: {
              assignments: { where: { isActive: true } },
              primaryApplications: { where: applicationWhere },
              assignedTasks: {
                where: {
                  organizationId,
                  dueAt: { lt: new Date() },
                  status: { in: ['Open', 'In Progress'] },
                },
              },
            },
          },
        },
      }),
      this.prisma.branch.findMany({
        where: { organizationId, status: 'Active' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.position.findMany({
        where: { organizationId, status: 'Active' },
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId,
          status: 'Active',
          OR: [
            { assignments: { some: { isActive: true } } },
            { primaryApplications: { some: {} } },
          ],
        },
        orderBy: { displayName: 'asc' },
        select: { id: true, displayName: true },
      }),
    ]);

    const acceptedOffers = offers.filter((offer) => offer.status === 'Accepted').length;
    const completedInterviews = interviews.filter((interview) => ['Completed', 'No-show'].includes(interview.status));
    const noShows = completedInterviews.filter((interview) => interview.status === 'No-show').length;
    const sourceCounts = new Map<string, { total: number; joined: number }>();
    for (const application of applications) {
      const source = application.source?.trim() || 'Unknown';
      const current = sourceCounts.get(source) ?? { total: 0, joined: 0 };
      current.total += 1;
      if (application.stage === 'Joined') current.joined += 1;
      sourceCounts.set(source, current);
    }
    const topSource = [...sourceCounts.entries()].sort((left, right) => right[1].total - left[1].total)[0];

    const timeToFill = joinedCases.length === 0
      ? 0
      : Math.round(joinedCases.reduce((total, hiringCase) => {
          const start = hiringCase.application.vacancy.openedAt;
          const end = hiringCase.actualJoiningDate;
          if (!start || !end) return total;
          return total + Math.max(0, (end.getTime() - start.getTime()) / DAY_MS);
        }, 0) / joinedCases.length);
    const timeToOffer = offers.length === 0
      ? 0
      : Math.round(offers.reduce((total, offer) =>
          total + Math.max(0, (offer.createdAt.getTime() - offer.application.appliedAt.getTime()) / DAY_MS), 0) / offers.length);

    const stageCounts = new Map<string, number>();
    applications.forEach((application) => stageCounts.set(application.stage, (stageCounts.get(application.stage) ?? 0) + 1));
    const appliedCount = stageCounts.get('Applied') ?? applications.length;
    const funnelStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];

    const hiringByPosition = new Map<string, { positionId: string; position: string; target: number; joined: number }>();
    for (const vacancy of vacancies) {
      const current = hiringByPosition.get(vacancy.positionId) ?? {
        positionId: vacancy.positionId,
        position: vacancy.position.title,
        target: 0,
        joined: 0,
      };
      current.target += vacancy.approvedHeadcount;
      current.joined += vacancy.applications.filter((application) => application.hiringCase?.status === 'Joined').length;
      hiringByPosition.set(vacancy.positionId, current);
    }

    const kpis: ReportKpis = {
      timeToFill: { value: timeToFill, change: 0 },
      timeToOffer: { value: timeToOffer, target: 25 },
      offerAcceptanceRate: {
        value: offers.length === 0 ? 0 : Math.round((acceptedOffers / offers.length) * 100),
        accepted: acceptedOffers,
        total: offers.length,
      },
      interviewNoShowRate: {
        value: completedInterviews.length === 0 ? 0 : Math.round((noShows / completedInterviews.length) * 100),
        noShows,
        total: completedInterviews.length,
      },
      topSource: {
        name: topSource?.[0] ?? 'No data',
        conversionRate: topSource && topSource[1].total > 0
          ? Math.round((topSource[1].joined / topSource[1].total) * 100)
          : 0,
      },
      totalJoined: {
        count: joinedCases.length,
        branches: new Set(joinedCases.map((item) => item.application.vacancy.branchId)).size,
      },
    };

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      comparisonRange: {
        from: range.comparisonFrom.toISOString(),
        to: range.comparisonTo.toISOString(),
      },
      kpis,
      comparison: {
        applications: comparisonApplications.length,
        offers: comparisonOffers,
        interviews: comparisonInterviews,
        joined: comparisonJoinedCases,
      },
      trend: this.buildTrend(range.from, range.to, applications, interviews, offers, joinedCases),
      sourceBreakdown: [...sourceCounts.entries()]
        .map(([name, values]) => ({
          name,
          total: values.total,
          joined: values.joined,
          conversionRate: values.total > 0 ? Math.round((values.joined / values.total) * 100) : 0,
        }))
        .sort((left, right) => right.total - left.total),
      funnel: funnelStages.map((name, index) => {
        const count = stageCounts.get(name) ?? 0;
        const previousName = index > 0 ? funnelStages[index - 1] : undefined;
        const previousCount = previousName ? (stageCounts.get(previousName) ?? 0) : null;
        const conversionRate = previousCount !== null && previousCount > 0 && count <= previousCount
          ? Math.round((count / previousCount) * 100)
          : null;
        return {
          name,
          count,
          percent: appliedCount === 0 ? 0 : Math.min(100, Math.round((count / appliedCount) * 100)),
          conversionRate,
        };
      }),
      hiringByPosition: [...hiringByPosition.values()].sort((left, right) => right.target - left.target),
      recruiterWorkload: users.map((user) => ({
        id: user.id,
        name: user.displayName,
        vacancies: user._count.assignments,
        applications: user._count.primaryApplications,
        overdueTasks: user._count.assignedTasks,
      })),
      filterOptions: {
        branches: filterBranches.map((branch) => ({ id: branch.id, label: branch.name })),
        positions: filterPositions.map((position) => ({ id: position.id, label: position.title })),
        recruiters: filterRecruiters.map((recruiter) => ({ id: recruiter.id, label: recruiter.displayName })),
      },
      recruitmentKpis: (() => {
        const targetHeadcount = vacancies.reduce((acc, v) => acc + (v.approvedHeadcount || 1), 0) || 1;
        const attendedInterviews = interviews.filter((i) => i.status === 'Completed').length;
        const invitationRate = interviews.length === 0 ? 0 : Math.round((attendedInterviews / interviews.length) * 100);
        const acceptedFinalRate = targetHeadcount === 0 ? 0 : Math.round((acceptedOffers / targetHeadcount) * 100);
        const offersVsTargetRate = targetHeadcount === 0 ? 0 : Math.round((offers.length / targetHeadcount) * 100);
        const hiresVsTargetRate = targetHeadcount === 0 ? 0 : Math.round((joinedCases.length / targetHeadcount) * 100);

        const ninetyDaysAgo = new Date(Date.now() - (90 * DAY_MS));
        const eligibleForProbation = joinedCases.filter((jc) => jc.actualJoiningDate && jc.actualJoiningDate <= ninetyDaysAgo);
        const passedProbation = eligibleForProbation.length;
        const probationRate = eligibleForProbation.length === 0 ? 100 : Math.round((passedProbation / eligibleForProbation.length) * 100);

        const kpiItems: RecruitmentKpiItem[] = [
          {
            id: 'kpi-invitation',
            position: 'Recruitment',
            name: 'Invitation',
            definition: 'Measures the percentage of sourced candidate’s actual attending the interviews.',
            currentValue: invitationRate,
            formattedValue: `${invitationRate}%`,
            targetValue: 80,
            formattedTarget: '80%',
            unit: '%',
            achievementRate: Math.min(100, Math.round((invitationRate / 80) * 100)),
            status: invitationRate >= 80 ? 'On Target' : 'Under Target',
            notes: `${attendedInterviews} attended of ${interviews.length} scheduled`,
          },
          {
            id: 'kpi-accepted-final',
            position: 'Recruitment',
            name: 'Accepted Final',
            definition: 'Measures the percentage of candidates who accepted the final offer Vs target',
            currentValue: acceptedFinalRate,
            formattedValue: `${acceptedFinalRate}%`,
            targetValue: 100,
            formattedTarget: '100%',
            unit: '%',
            achievementRate: Math.min(100, acceptedFinalRate),
            status: acceptedFinalRate >= 100 ? 'Exceeded' : acceptedFinalRate >= 80 ? 'On Target' : 'Under Target',
            notes: `${acceptedOffers} accepted offers vs ${targetHeadcount} target positions`,
          },
          {
            id: 'kpi-offers',
            position: 'Recruitment',
            name: 'Offers',
            definition: 'Measures the percentage of offers Vs. target.',
            currentValue: offersVsTargetRate,
            formattedValue: `${offersVsTargetRate}%`,
            targetValue: 100,
            formattedTarget: '100%',
            unit: '%',
            achievementRate: Math.min(100, offersVsTargetRate),
            status: offersVsTargetRate >= 100 ? 'Exceeded' : offersVsTargetRate >= 80 ? 'On Target' : 'Under Target',
            notes: `${offers.length} extended offers vs ${targetHeadcount} target positions`,
          },
          {
            id: 'kpi-hires',
            position: 'Recruitment',
            name: 'Hires',
            definition: 'Measures the percentage of hires vs the target',
            currentValue: hiresVsTargetRate,
            formattedValue: `${hiresVsTargetRate}%`,
            targetValue: 100,
            formattedTarget: '100%',
            unit: '%',
            achievementRate: Math.min(100, hiresVsTargetRate),
            status: hiresVsTargetRate >= 100 ? 'Exceeded' : hiresVsTargetRate >= 80 ? 'On Target' : 'Under Target',
            notes: `${joinedCases.length} confirmed hires vs ${targetHeadcount} target positions`,
          },
          {
            id: 'kpi-time-to-fill',
            position: 'Recruitment',
            name: 'Time to Fill',
            definition: 'The total number of calendar days from when a job requisition is approved to when a candidate accepts the Hire.',
            currentValue: timeToFill,
            formattedValue: `${timeToFill} Days`,
            targetValue: 30,
            formattedTarget: '≤ 30 Days',
            unit: 'Days',
            achievementRate: timeToFill === 0 ? 100 : Math.min(100, Math.round((30 / Math.max(1, timeToFill)) * 100)),
            status: timeToFill > 0 && timeToFill <= 30 ? 'On Target' : timeToFill > 30 ? 'Under Target' : 'On Target',
            notes: 'Calculated from requisition approved opening to candidate hire acceptance/joining',
          },
          {
            id: 'kpi-quality-of-hire',
            position: 'Recruitment',
            name: 'Quality of Hire (Probation Success Rate)',
            definition: 'The percentage of new hires who successfully complete their probation period and meet performance expectations.',
            currentValue: probationRate,
            formattedValue: `${probationRate}%`,
            targetValue: 90,
            formattedTarget: '≥ 90%',
            unit: '%',
            achievementRate: Math.min(100, Math.round((probationRate / 90) * 100)),
            status: probationRate >= 90 ? 'On Target' : 'Under Target',
            notes: 'Standard 90-day post-joining retention & performance success',
          },
        ];

        return kpiItems;
      })(),
    };
  }

  async exportExcel(organizationId: string, query: ReportOverviewQueryDto, user?: AuthUser): Promise<Buffer> {
    try {
      const overview = await this.getOverview(organizationId, query, user);
      const workbook = XLSX.utils.book_new();
      const currentTotals = overview.trend.reduce(
        (totals, point) => ({
          applications: totals.applications + point.applications,
          interviews: totals.interviews + point.interviews,
          offers: totals.offers + point.offers,
          joined: totals.joined + point.joined,
        }),
        { applications: 0, interviews: 0, offers: 0, joined: 0 },
      );
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['RecruitFlow Recruitment Performance Report'],
        ['From', overview.range.from],
        ['To', overview.range.to],
        ['Comparison from', overview.comparisonRange.from],
        ['Comparison to', overview.comparisonRange.to],
        [],
        ['Metric', 'Current', 'Comparison'],
        ['Applications', currentTotals.applications, overview.comparison.applications],
        ['Interviews', currentTotals.interviews, overview.comparison.interviews],
        ['Offers', currentTotals.offers, overview.comparison.offers],
        ['Joined', currentTotals.joined, overview.comparison.joined],
        ['Time to fill (days)', overview.kpis.timeToFill.value, ''],
        ['Time to offer (days)', overview.kpis.timeToOffer.value, ''],
        ['Offer acceptance rate (%)', overview.kpis.offerAcceptanceRate.value, ''],
        ['Interview no-show rate (%)', overview.kpis.interviewNoShowRate.value, ''],
        ['Top source', overview.kpis.topSource.name, ''],
      ]), 'Summary');

      if (overview.recruitmentKpis && overview.recruitmentKpis.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
          ['Saudi German Health - Recruitment KPIs Scorecard'],
          ['Reporting Range', `${overview.range.from} to ${overview.range.to}`],
          ['Generated At', new Date().toISOString()],
          [],
          ['Position', 'KPI Name', 'Definition', 'Current Value', 'Target', 'Status', 'Notes'],
          ...overview.recruitmentKpis.map((k) => [
            k.position,
            k.name,
            k.definition,
            k.formattedValue,
            k.formattedTarget,
            k.status,
            k.notes || '',
          ]),
        ]), 'Recruitment KPIs');
      }

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.trend), 'Trend');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.funnel.map((stage) => ({
        stage: stage.name,
        count: stage.count,
        percentOfApplications: stage.percent,
        conversionFromPrevious: stage.conversionRate ?? 'Not comparable',
      }))), 'Funnel');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.hiringByPosition), 'Hiring by Position');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.recruiterWorkload), 'Recruiter Workload');
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw exportFailed('The report could not be exported. Please try again.');
    }
  }

  private resolveRange(query: ReportOverviewQueryDto): ResolvedReportRange {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - (29 * DAY_MS));
    if (from > to) throw new BadRequestException('Report start date must be before the end date.');

    const duration = Math.max(DAY_MS, to.getTime() - from.getTime());
    const comparisonTo = query.comparisonTo ? new Date(query.comparisonTo) : new Date(from.getTime() - 1);
    const comparisonFrom = query.comparisonFrom
      ? new Date(query.comparisonFrom)
      : new Date(comparisonTo.getTime() - duration);
    if (comparisonFrom > comparisonTo) {
      throw new BadRequestException('Comparison start date must be before the comparison end date.');
    }

    return { from, to, comparisonFrom, comparisonTo };
  }

  private applicationRelationFilter(
    query: ReportOverviewQueryDto,
    visibility?: Prisma.ApplicationWhereInput,
  ): Prisma.ApplicationWhereInput {
    const result: Prisma.ApplicationWhereInput = { ...(visibility ?? {}) };
    if (query.recruiterId) result.primaryRecruiterId = query.recruiterId;
    if (query.branchId || query.positionId) {
      const existingVacancy = (visibility?.vacancy ?? {}) as Prisma.VacancyWhereInput;
      result.vacancy = {
        ...existingVacancy,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.positionId ? { positionId: query.positionId } : {}),
      };
    }
    return result;
  }

  private applicationWhere(
    organizationId: string,
    from: Date,
    to: Date,
    query: ReportOverviewQueryDto,
    visibility?: Prisma.ApplicationWhereInput,
  ): Prisma.ApplicationWhereInput {
    return {
      ...(visibility ?? {}),
      organizationId,
      createdAt: { gte: from, lte: to },
      ...this.applicationRelationFilter(query, visibility),
    };
  }

  private buildTrend(
    from: Date,
    to: Date,
    applications: Array<{ createdAt: Date }>,
    interviews: Array<{ scheduledStart: Date }>,
    offers: Array<{ createdAt: Date }>,
    joinedCases: Array<{ actualJoiningDate: Date | null }>,
  ): ReportTrendPoint[] {
    const durationDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
    const bucketDays = durationDays <= 31 ? 1 : durationDays <= 120 ? 7 : 30;
    const bucketMs = bucketDays * DAY_MS;
    const points: ReportTrendPoint[] = [];

    for (let start = from.getTime(); start <= to.getTime(); start += bucketMs) {
      const end = Math.min(to.getTime() + 1, start + bucketMs);
      const inBucket = (value: Date | null) => value !== null && value.getTime() >= start && value.getTime() < end;
      const startDate = new Date(start);
      points.push({
        periodStart: startDate.toISOString(),
        label: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        applications: applications.filter((item) => inBucket(item.createdAt)).length,
        interviews: interviews.filter((item) => inBucket(item.scheduledStart)).length,
        offers: offers.filter((item) => inBucket(item.createdAt)).length,
        joined: joinedCases.filter((item) => inBucket(item.actualJoiningDate)).length,
      });
    }

    return points;
  }

  async getKpis(organizationId: string, user?: AuthUser): Promise<ReportKpis> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const [applications, offers, interviews, joinedCases] = await Promise.all([
      this.prisma.application.findMany({
        where: visibility,
        select: { source: true, stage: true, createdAt: true },
      }),
      this.prisma.offer.findMany({
        where: { organizationId, application: visibility },
        select: {
          status: true,
          createdAt: true,
          application: { select: { createdAt: true } },
        },
      }),
      this.prisma.interview.findMany({
        where: { organizationId, application: visibility },
        select: { status: true },
      }),
      this.prisma.hiringCase.findMany({
        where: { organizationId, status: 'Joined', application: visibility },
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
      : Math.max(0, Math.round(
          joinedCases.reduce((sum, item) => {
            const end = item.actualJoiningDate ?? item.createdAt;
            const diff = (end.getTime() - item.createdAt.getTime()) / 86_400_000;
            return sum + Math.max(0, diff);
          }, 0) / joinedCases.length,
        ));
    const averageTimeToOffer = offers.length === 0
      ? 0
      : Math.max(0, Math.round(
          offers.reduce((sum, offer) => {
            const diff = (offer.createdAt.getTime() - offer.application.createdAt.getTime()) / 86_400_000;
            return sum + Math.max(0, diff);
          }, 0) / offers.length,
        ));

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

  async getFunnel(organizationId: string, user?: AuthUser): Promise<FunnelStage[]> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const grouped = await this.prisma.application.groupBy({
      by: ['stage'],
      where: visibility,
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

  async getHiringByDepartment(organizationId: string, user?: AuthUser): Promise<DepartmentHiring[]> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const vacancies = await this.prisma.vacancy.findMany({
      where: { organizationId, applications: { some: visibility } },
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

  async getRecruiterWorkload(organizationId: string, user?: AuthUser): Promise<RecruiterWorkload[]> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'Active' },
      select: {
        id: true,
        displayName: true,
        _count: { select: { primaryApplications: { where: visibility }, assignments: { where: { isActive: true } } } },
      },
    });
    return users.map((user) => ({
      id: user.id,
      name: user.displayName,
      vacancies: user._count.assignments,
      applications: user._count.primaryApplications,
      overdueTasks: 0,
    }));
  }
}
