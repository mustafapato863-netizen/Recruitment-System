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
  EntityReport,
  RecruiterWorkload,
  ReportOverview,
  ReportTrendPoint,
  RecruitmentKpiItem,
  ReportReachedFunnel,
  ReportFunnelRecord,
  ReportTimeToHire,
  ReportStageDuration,
  ReportWaitingFile,
  ReportCompletedHireRecord,
  ReportSourcePerformance,
  ReportSourceOutcome,
  ReportSourceRecord,
  ReportFollowUpsSection,
  ReportFollowUpItem,
  ReportSummaryCardMetric,
  ReportSummaryCards,
  ReportTopJobItem,
} from '@recruitflow/contracts';
import type { AuthUser } from '@recruitflow/contracts';
import type { ReportOverviewQueryDto } from './reports.dto';
import { monthRange, parseCairoDateBound } from '../results/results.calc';

const DAY_MS = 86_400_000;
const REPORTING_ROLE_CODES = ['ADMINISTRATOR', 'TALENT_MANAGER', 'HR_MANAGER', 'PERFORMANCE_ADMIN'];
const PROGRESSION_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'] as const;
const DEFAULT_WAITING_THRESHOLD_DAYS = 7;

interface ResolvedReportRange {
  from: Date;
  to: Date;
}

export function normalizeReportSource(raw?: string | null): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return 'Unknown';
  const lower = trimmed.toLowerCase();
  if (lower === 'unknown' || lower === 'other' || lower === 'n/a' || lower === 'none') return 'Unknown';
  if (lower.includes('linkedin') || lower.includes('linked in')) return 'LinkedIn';
  if (lower.includes('career') || lower.includes('website') || lower.includes('portal') || lower.includes('job board')) {
    return 'Career Site';
  }
  if (lower.includes('refer') || lower.includes('employee ref') || lower.includes('internal ref')) {
    return 'Referral';
  }
  if (lower.includes('agency') || lower.includes('headhunter') || lower.includes('vendor') || lower.includes('partner')) {
    return 'Agency';
  }
  if (
    lower.includes('direct') ||
    lower.includes('bank') ||
    lower.includes('sourcing') ||
    lower.includes('upload') ||
    lower.includes('import') ||
    lower.includes('walk-in')
  ) {
    return 'Direct / Bank';
  }
  return trimmed;
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return Math.round(sorted[mid]!);
  }
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

type OfferApprovalShape = { status: string; approver?: { displayName: string } | null };

function extractOfferApprovals(offer: {
  approvals?: OfferApprovalShape[];
  versions?: Array<{ approvals?: OfferApprovalShape[] }>;
}): OfferApprovalShape[] {
  if (offer.approvals && offer.approvals.length > 0) return offer.approvals;
  return (offer.versions ?? []).flatMap((v) => v.approvals ?? []);
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
    const asOfDate = new Date();
    const range = this.resolveRange(query);
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const applicationWhere = this.applicationWhere(organizationId, range.from, range.to, query, visibility);
    const openApplicationsWhere: Prisma.ApplicationWhereInput = {
      AND: [
        { organizationId, stage: { notIn: ['Joined', 'Rejected', 'Withdrawn'] } },
        this.applicationRelationFilter(query, visibility),
      ],
    };
    const canViewRecruiterTeam = !user || user.roleCodes.some((roleCode) => REPORTING_ROLE_CODES.includes(roleCode));
    const recruiterUserScope = user && !canViewRecruiterTeam ? { id: user.userId } : {};

    const [
      applications,
      openApplicationsRaw,
      offers,
      interviews,
      joinedCasesRaw,
      vacancies,
      users,
      filterBranches,
      filterPositions,
      filterRecruiters,
      openTasksRaw,
    ] = await Promise.all([
      this.prisma.application.findMany({
        where: applicationWhere,
        select: {
          id: true,
          candidateId: true,
          vacancyId: true,
          source: true,
          stage: true,
          appliedAt: true,
          createdAt: true,
          updatedAt: true,
          followUpDate: true,
          candidate: { select: { id: true, firstName: true, lastName: true } },
          vacancy: { select: { id: true, vacancyCode: true, position: { select: { title: true } } } },
          primaryRecruiter: { select: { id: true, displayName: true } },
          statusHistory: {
            select: { fromStage: true, toStage: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          interviews: {
            select: {
              id: true,
              status: true,
              scheduledStart: true,
              attendees: { select: { userId: true, user: { select: { displayName: true } } } },
              scorecards: { select: { interviewerId: true, submittedAt: true } },
            },
          },
          offers: {
            select: {
              id: true,
              status: true,
              versions: {
                select: {
                  approvals: { select: { status: true, approver: { select: { displayName: true } } } },
                },
              },
            },
          },
          hiringCase: {
            select: {
              id: true,
              status: true,
              actualJoiningDate: true,
              approvals: { select: { status: true, approver: { select: { displayName: true } } } },
            },
          },
        },
      }),
      this.prisma.application.findMany({
        where: openApplicationsWhere,
        select: {
          id: true,
          candidateId: true,
          vacancyId: true,
          stage: true,
          appliedAt: true,
          createdAt: true,
          updatedAt: true,
          followUpDate: true,
          candidate: { select: { id: true, firstName: true, lastName: true } },
          vacancy: { select: { id: true, vacancyCode: true, position: { select: { title: true } } } },
          primaryRecruiter: { select: { id: true, displayName: true } },
          statusHistory: {
            select: { fromStage: true, toStage: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          notes: {
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          screeningLogs: {
            select: { screenedAt: true },
            orderBy: { screenedAt: 'desc' },
            take: 1,
          },
          interviews: {
            select: {
              id: true,
              status: true,
              scheduledStart: true,
              attendees: { select: { userId: true, user: { select: { displayName: true } } } },
              scorecards: { select: { interviewerId: true, submittedAt: true } },
            },
          },
          offers: {
            select: {
              id: true,
              status: true,
              versions: {
                select: {
                  approvals: { select: { status: true, approver: { select: { displayName: true } } } },
                },
              },
            },
          },
          hiringCase: {
            select: {
              id: true,
              status: true,
              approvals: { select: { status: true, approver: { select: { displayName: true } } } },
            },
          },
        },
      }),
      this.prisma.offer.findMany({
        where: {
          organizationId,
          createdAt: { gte: range.from, lt: range.to },
          application: this.applicationRelationFilter(query, visibility),
        },
        select: {
          status: true,
          createdAt: true,
          application: { select: { appliedAt: true } },
        },
      }),
      this.prisma.interview.findMany({
        where: {
          organizationId,
          scheduledStart: { gte: range.from, lt: range.to },
          application: this.applicationRelationFilter(query, visibility),
        },
        select: { status: true, scheduledStart: true },
      }),
      this.prisma.hiringCase.findMany({
        where: {
          organizationId,
          status: 'Joined',
          actualJoiningDate: { gte: range.from, lt: range.to },
          application: this.applicationRelationFilter(query, visibility),
        },
        select: {
          applicationId: true,
          actualJoiningDate: true,
          application: {
            select: {
              id: true,
              candidateId: true,
              vacancyId: true,
              appliedAt: true,
              createdAt: true,
              candidate: { select: { firstName: true, lastName: true } },
              primaryRecruiter: { select: { displayName: true } },
              vacancy: {
                select: {
                  id: true,
                  branchId: true,
                  openedAt: true,
                  positionId: true,
                  position: { select: { title: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.vacancy.findMany({
        where: {
          organizationId,
          status: { not: 'Cancelled' },
          ...(query.vacancyId ? { id: query.vacancyId } : {}),
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.positionId ? { positionId: query.positionId } : {}),
          ...(user && !canViewRecruiterTeam ? { applications: { some: visibility } } : {}),
        },
        select: {
          id: true,
          vacancyCode: true,
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
          ...(user && !canViewRecruiterTeam
            ? { id: user.userId }
            : query.recruiterId ? { id: query.recruiterId } : {}),
          OR: [
            { userRoles: { some: { role: { code: 'RECRUITER', status: 'Active' } } } },
            { assignments: { some: { isActive: true, roleCode: 'RECRUITER', vacancy: { organizationId } } } },
            { primaryApplications: { some: applicationWhere } },
          ],
        },
        select: {
          id: true,
          displayName: true,
          _count: {
            select: {
              assignments: {
                where: {
                  isActive: true,
                  roleCode: 'RECRUITER',
                  vacancy: { organizationId },
                },
              },
              primaryApplications: { where: applicationWhere },
              assignedTasks: {
                where: {
                  organizationId,
                  dueAt: { lt: asOfDate },
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
          ...recruiterUserScope,
          OR: [
            { userRoles: { some: { role: { code: 'RECRUITER', status: 'Active' } } } },
            { assignments: { some: { isActive: true, roleCode: 'RECRUITER', vacancy: { organizationId } } } },
            { primaryApplications: { some: { organizationId } } },
          ],
        },
        orderBy: { displayName: 'asc' },
        select: { id: true, displayName: true },
      }),
      this.prisma.task?.findMany
        ? this.prisma.task.findMany({
            where: {
              organizationId,
              status: { in: ['Open', 'In Progress'] },
              ...(user && !canViewRecruiterTeam
                ? { assigneeUserId: user.userId }
                : query.recruiterId ? { assigneeUserId: query.recruiterId } : {}),
            },
            orderBy: { dueAt: 'asc' },
            take: 50,
            select: {
              id: true,
              title: true,
              dueAt: true,
              entityType: true,
              entityId: true,
              assignee: { select: { displayName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    // B8: activity counters (audit-log action counts per recruiter) were removed: v2 §9 does not score activity.
    const seenJoinedApps = new Set<string>();
    const joinedCases = joinedCasesRaw.filter((hc) => {
      if (!hc.actualJoiningDate) return false;
      const appId = (hc as { applicationId?: string }).applicationId;
      if (!appId) return true;
      if (seenJoinedApps.has(appId)) return false;
      seenJoinedApps.add(appId);
      return true;
    });

    const sentOffers = offers.filter((offer) => offer.status !== 'Draft');
    const acceptedOffers = sentOffers.filter((offer) => offer.status === 'Accepted').length;
    const completedInterviews = interviews.filter((interview) => ['Completed', 'No-show'].includes(interview.status));
    const noShows = completedInterviews.filter((interview) => interview.status === 'No-show').length;
    const sourceCounts = new Map<string, { total: number; joined: number }>();
    for (const application of applications) {
      const source = normalizeReportSource(application.source);
      const current = sourceCounts.get(source) ?? { total: 0, joined: 0 };
      current.total += 1;
      const hc = (application as { hiringCase?: { status: string } | null }).hiringCase;
      if (application.stage === 'Joined' || hc?.status === 'Joined') current.joined += 1;
      sourceCounts.set(source, current);
    }
    const topSource = [...sourceCounts.entries()].sort((left, right) => right[1].total - left[1].total)[0];

    const timeToFillSamples = joinedCases.flatMap((hiringCase) => {
      const start = hiringCase.application?.vacancy?.openedAt;
      const end = hiringCase.actualJoiningDate;
      return start && end ? [Math.max(0, (end.getTime() - start.getTime()) / DAY_MS)] : [];
    });
    const timeToFill = timeToFillSamples.length > 0
      ? Math.round(timeToFillSamples.reduce((total, days) => total + days, 0) / timeToFillSamples.length)
      : 0;
    const timeToOffer = sentOffers.length === 0
      ? 0
      : Math.round(sentOffers.reduce((total, offer) =>
          total + Math.max(0, (offer.createdAt.getTime() - offer.application.appliedAt.getTime()) / DAY_MS), 0) / sentOffers.length);

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
      timeToFill: { value: timeToFill, sampleCount: timeToFillSamples.length },
      timeToOffer: { value: timeToOffer, target: 25 },
      offerAcceptanceRate: {
        value: sentOffers.length === 0 ? 0 : Math.round((acceptedOffers / sentOffers.length) * 100),
        accepted: acceptedOffers,
        total: sentOffers.length,
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

    const openApplications =
      openApplicationsRaw ?? applications.filter((a) => !['Joined', 'Rejected', 'Withdrawn'].includes(a.stage));
    const openTasks = openTasksRaw ?? [];
    const reachedFunnel = this.buildReachedFunnel(applications, asOfDate);
    const timeToHire = this.buildTimeToHire(applications, openApplications, joinedCases, asOfDate, user);
    const sourcePerformance = this.buildSourcePerformance(applications, reachedFunnel);
    const followUps = this.buildFollowUps(openApplications, openTasks, canViewRecruiterTeam, asOfDate, user);
    const distinctCandidateIds = new Set(applications.map((application) => application.candidateId || application.id));
    const newCandidatesCount = distinctCandidateIds.size;
    const summaryCards = await this.buildSummaryCards(
      organizationId,
      range,
      query,
      visibility,
      newCandidatesCount,
      interviews.length,
      sentOffers.length,
      joinedCases.length,
    );
    const topJobs = this.buildTopJobs(applications);

    return {
      asOf: asOfDate.toISOString(),
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      kpis,
      summaryCards,
      topJobs,
      trend: this.buildTrend(range.from, range.to, applications, interviews, sentOffers, joinedCases),
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
      recruiterWorkload: users.map((u) => ({
        id: u.id,
        name: u.displayName,
        vacancies: u._count.assignments,
        applications: u._count.primaryApplications,
        overdueTasks: u._count.assignedTasks,
      })),
      filterOptions: {
        branches: filterBranches.map((branch) => ({ id: branch.id, label: branch.name })),
        positions: filterPositions.map((position) => ({ id: position.id, label: position.title })),
        recruiters: filterRecruiters.map((recruiter) => ({ id: recruiter.id, label: recruiter.displayName })),
        vacancies: vacancies
          .filter((v) => Boolean(v.id))
          .map((v) => ({
            id: v.id,
            label: v.vacancyCode ? `${v.position.title} (${v.vacancyCode})` : v.position.title,
          })),
      },
      reachedFunnel,
      timeToHire,
      sourcePerformance,
      followUps,
      recruitmentKpis: (() => {
        const targetHeadcount = vacancies.reduce((acc, vacancy) => acc + Math.max(0, vacancy.approvedHeadcount), 0);
        const attendedInterviews = interviews.filter((interview) => interview.status === 'Completed').length;
        const attendanceDenominator = completedInterviews.length;
        const invitationRate = attendanceDenominator > 0 ? Math.round((attendedInterviews / attendanceDenominator) * 100) : 0;
        const acceptedFinalRate = targetHeadcount > 0 ? Math.round((acceptedOffers / targetHeadcount) * 100) : 0;
        const offersVsTargetRate = targetHeadcount > 0 ? Math.round((sentOffers.length / targetHeadcount) * 100) : 0;
        const hiresVsTargetRate = targetHeadcount > 0 ? Math.round((joinedCases.length / targetHeadcount) * 100) : 0;

        const kpiItems: RecruitmentKpiItem[] = [
          {
            id: 'kpi-invitation',
            position: 'Recruitment',
            name: 'Interview Attendance',
            definition: 'The share of completed interview records marked Completed rather than No-show.',
            currentValue: invitationRate,
            formattedValue: `${invitationRate}%`,
            targetValue: 80,
            formattedTarget: '80%',
            unit: '%',
            achievementRate: Math.min(100, Math.round((invitationRate / 80) * 100)),
            status: invitationRate >= 80 ? 'On Target' : 'Under Target',
            notes: `${attendedInterviews} attended of ${attendanceDenominator} completed or no-show interviews`,
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
            notes: `${sentOffers.length} extended offers vs ${targetHeadcount} target positions`,
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
            definition: 'Average calendar days from vacancy opening to actual joining for hires in the selected period.',
            currentValue: timeToFill,
            formattedValue: `${timeToFill} Days`,
            targetValue: 30,
            formattedTarget: '≤ 30 Days',
            unit: 'Days',
            achievementRate: timeToFill === 0 ? 100 : Math.min(100, Math.round((30 / Math.max(1, timeToFill)) * 100)),
            status: timeToFill > 0 && timeToFill <= 30 ? 'On Target' : timeToFill > 30 ? 'Under Target' : 'On Target',
            notes: 'Calculated from vacancy opening date to actual joining date; hires without either date are excluded.',
          },
        ];

        return kpiItems.filter((item) => {
          if (item.id === 'kpi-invitation') return attendanceDenominator > 0;
          if (['kpi-accepted-final', 'kpi-offers', 'kpi-hires'].includes(item.id)) return targetHeadcount > 0;
          if (item.id === 'kpi-time-to-fill') return timeToFillSamples.length > 0;
          return false;
        });
      })(),
    };
  }

  private async buildSummaryCards(
    organizationId: string,
    range: ResolvedReportRange,
    query: ReportOverviewQueryDto,
    visibility: Prisma.ApplicationWhereInput | undefined,
    newCandidatesCount: number,
    interviewsCount: number,
    offersCount: number,
    hiresCount: number,
  ): Promise<ReportSummaryCards> {
    const durationMs = Math.max(DAY_MS, range.to.getTime() - range.from.getTime());
    const prevFrom = new Date(range.from.getTime() - durationMs);
    const prevTo = range.from;
    const relFilter = this.applicationRelationFilter(query, visibility);

    const hasCountApi =
      typeof this.prisma.application?.count === 'function' &&
      typeof this.prisma.interview?.count === 'function' &&
      typeof this.prisma.offer?.count === 'function' &&
      typeof this.prisma.hiringCase?.count === 'function';

    let prevApps: number | null = null;
    let prevInterviews: number | null = null;
    let prevOffers: number | null = null;
    let prevHires: number | null = null;

    if (hasCountApi) {
      try {
        [prevApps, prevInterviews, prevOffers, prevHires] = await Promise.all([
          this.prisma.application.count({
            where: this.applicationWhere(organizationId, prevFrom, prevTo, query, visibility),
          }),
          this.prisma.interview.count({
            where: {
              organizationId,
              scheduledStart: { gte: prevFrom, lt: prevTo },
              application: relFilter,
            },
          }),
          this.prisma.offer.count({
            where: {
              organizationId,
              status: { not: 'Draft' },
              createdAt: { gte: prevFrom, lt: prevTo },
              application: relFilter,
            },
          }),
          this.prisma.hiringCase.count({
            where: {
              organizationId,
              status: 'Joined',
              actualJoiningDate: { gte: prevFrom, lt: prevTo },
              application: relFilter,
            },
          }),
        ]);
      } catch {
        prevApps = null;
        prevInterviews = null;
        prevOffers = null;
        prevHires = null;
      }
    }

    const toMetric = (count: number, previousCount: number | null): ReportSummaryCardMetric => ({
      count,
      previousCount,
      changePct:
        previousCount !== null && previousCount > 0
          ? Math.round(((count - previousCount) / previousCount) * 100)
          : null,
    });

    return {
      newCandidates: toMetric(newCandidatesCount, prevApps),
      interviewsScheduled: toMetric(interviewsCount, prevInterviews),
      offersSent: toMetric(offersCount, prevOffers),
      hires: toMetric(hiresCount, prevHires),
    };
  }

  private buildTopJobs(
    applications: Array<{
      vacancyId?: string;
      stage: string;
      vacancy?: { id: string; vacancyCode?: string | null; position?: { title: string } | null } | null;
      hiringCase?: { status: string } | null;
    }>,
  ): ReportTopJobItem[] {
    const byTitle = new Map<string, ReportTopJobItem>();
    for (const app of applications) {
      const vacancyId = app.vacancyId ?? app.vacancy?.id ?? '';
      const jobTitle = app.vacancy?.position?.title?.trim() || 'Job';
      const vacancyCode = app.vacancy?.vacancyCode ?? null;
      const existing = byTitle.get(jobTitle) ?? {
        vacancyId,
        jobTitle,
        vacancyCode,
        applicationsCount: 0,
        joinedCount: 0,
      };
      existing.applicationsCount += 1;
      if (app.stage === 'Joined' || app.hiringCase?.status === 'Joined') {
        existing.joinedCount += 1;
      }
      byTitle.set(jobTitle, existing);
    }
    return [...byTitle.values()].sort(
      (a, b) => b.applicationsCount - a.applicationsCount || a.jobTitle.localeCompare(b.jobTitle),
    );
  }

  private computeReachedStagesForApp(app: {
    stage: string;
    statusHistory?: Array<{ fromStage?: string | null; toStage: string }>;
    interviews?: Array<{ id: string }>;
    offers?: Array<{ id: string }>;
    hiringCase?: { status: string } | null;
  }): string[] {
    const reached = new Set<string>(['Applied']);
    const markUpTo = (stageName?: string | null) => {
      if (!stageName) return;
      const idx = PROGRESSION_STAGES.indexOf(stageName as (typeof PROGRESSION_STAGES)[number]);
      if (idx >= 0) {
        for (let i = 0; i <= idx; i += 1) {
          reached.add(PROGRESSION_STAGES[i]!);
        }
      }
    };
    markUpTo(app.stage);
    for (const h of app.statusHistory ?? []) {
      markUpTo(h.fromStage);
      markUpTo(h.toStage);
    }
    if ((app.interviews?.length ?? 0) > 0) {
      markUpTo('Interview');
    }
    if ((app.offers?.length ?? 0) > 0) {
      markUpTo('Offer');
    }
    if (app.hiringCase?.status === 'Joined') {
      markUpTo('Joined');
    }
    return PROGRESSION_STAGES.filter((s) => reached.has(s));
  }

  private describeBlockerForApp(
    app: {
      stage: string;
      followUpDate?: Date | null;
      primaryRecruiter?: { displayName: string } | null;
      interviews?: Array<{
        id: string;
        status: string;
        scheduledStart: Date;
        attendees?: Array<{ userId: string; user?: { displayName: string } | null }>;
        scorecards?: Array<{ interviewerId: string; submittedAt?: Date | null }>;
      }>;
      offers?: Array<{
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
        versions?: Array<{ approvals?: OfferApprovalShape[] }>;
      }>;
      hiringCase?: {
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
      } | null;
    },
    asOfDate: Date,
    user?: AuthUser,
  ): {
    blockerLabel: string;
    blockerKind: ReportWaitingFile['blockerKind'];
    interviewId: string | null;
    canRemindInterviewer: boolean;
    canSubmitOwnScorecard: boolean;
  } {
    const ownerName = app.primaryRecruiter?.displayName ?? 'Unassigned';
    for (const iv of app.interviews ?? []) {
      const isPastOrCompleted = iv.status === 'Completed' || (iv.status === 'Scheduled' && iv.scheduledStart <= asOfDate);
      if (!isPastOrCompleted) continue;
      const submittedIds = new Set(
        (iv.scorecards ?? []).filter((sc) => sc.submittedAt !== null).map((sc) => sc.interviewerId),
      );
      const pendingAttendees = (iv.attendees ?? []).filter((att) => !submittedIds.has(att.userId));
      if (pendingAttendees.length > 0) {
        const names = pendingAttendees.map((a) => a.user?.displayName || 'Interviewer').join(', ');
        const pendingIds = pendingAttendees.map((a) => a.userId);
        const canSubmitOwnScorecard = Boolean(user && pendingIds.includes(user.userId));
        const canRemindInterviewer = Boolean(
          pendingIds.length > 0 && (!user || pendingIds.some((id) => id !== user.userId)),
        );
        return {
          blockerLabel: `Pending scorecard (${names})`,
          blockerKind: 'INTERVIEW_FEEDBACK',
          interviewId: iv.id,
          canRemindInterviewer,
          canSubmitOwnScorecard,
        };
      }
    }

    for (const offer of app.offers ?? []) {
      const approvals = extractOfferApprovals(offer);
      const pendingApprovals = approvals.filter((a) => a.status === 'Pending');
      if (offer.status === 'Pending Approval' || pendingApprovals.length > 0) {
        const approverNames = pendingApprovals.map((a) => a.approver?.displayName).filter(Boolean).join(', ');
        return {
          blockerLabel: approverNames ? `Offer approval (${approverNames})` : 'Awaiting offer approval',
          blockerKind: 'OFFER_APPROVAL',
          interviewId: null,
          canRemindInterviewer: false,
          canSubmitOwnScorecard: false,
        };
      }
    }

    const pendingHcApprovals = (app.hiringCase?.approvals ?? []).filter((a) => a.status === 'Pending');
    if (pendingHcApprovals.length > 0) {
      const approverNames = pendingHcApprovals.map((a) => a.approver?.displayName).filter(Boolean).join(', ');
      return {
        blockerLabel: approverNames ? `Hiring approval (${approverNames})` : 'Awaiting final approval',
        blockerKind: 'HIRING_APPROVAL',
        interviewId: null,
        canRemindInterviewer: false,
        canSubmitOwnScorecard: false,
      };
    }

    if (app.followUpDate && app.followUpDate <= asOfDate) {
      return {
        blockerLabel: `Follow-up due (${ownerName})`,
        blockerKind: 'FOLLOW_UP_DUE',
        interviewId: null,
        canRemindInterviewer: false,
        canSubmitOwnScorecard: false,
      };
    }

    return {
      blockerLabel: `In ${app.stage} (${ownerName})`,
      blockerKind: 'STAGE_PROGRESSION',
      interviewId: null,
      canRemindInterviewer: false,
      canSubmitOwnScorecard: false,
    };
  }

  private buildReachedFunnel(
    applications: Array<{
      id: string;
      candidateId?: string;
      vacancyId?: string;
      stage: string;
      appliedAt: Date;
      createdAt: Date;
      updatedAt?: Date;
      followUpDate?: Date | null;
      candidate?: { firstName: string; lastName: string } | null;
      vacancy?: { id: string; position?: { title: string } | null } | null;
      primaryRecruiter?: { displayName: string } | null;
      statusHistory?: Array<{ fromStage?: string | null; toStage: string; createdAt: Date }>;
      interviews?: Array<{
        id: string;
        status: string;
        scheduledStart: Date;
        attendees?: Array<{ userId: string; user?: { displayName: string } | null }>;
        scorecards?: Array<{ interviewerId: string; submittedAt?: Date | null }>;
      }>;
      offers?: Array<{
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
        versions?: Array<{ approvals?: OfferApprovalShape[] }>;
      }>;
      hiringCase?: {
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
      } | null;
    }>,
    asOfDate: Date,
  ): ReportReachedFunnel {
    const cohortTotal = applications.length;
    const records: ReportFunnelRecord[] = applications.map((app) => {
      const reachedStages = this.computeReachedStagesForApp(app);
      const outcome: ReportFunnelRecord['outcome'] =
        app.stage === 'Joined' || app.hiringCase?.status === 'Joined'
          ? 'JOINED'
          : app.stage === 'Rejected'
          ? 'REJECTED'
          : app.stage === 'Withdrawn'
          ? 'WITHDRAWN'
          : 'ACTIVE';
      const candidateName = app.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
        : 'Candidate';
      const jobTitle = app.vacancy?.position?.title ?? 'Job';
      const ownerName = app.primaryRecruiter?.displayName ?? 'Unassigned';
      const blocker =
        outcome === 'ACTIVE'
          ? this.describeBlockerForApp(app, asOfDate).blockerLabel
          : outcome === 'JOINED'
          ? 'Joined'
          : outcome === 'REJECTED'
          ? 'Closed (Rejected)'
          : 'Closed (Withdrawn)';
      return {
        applicationId: app.id,
        candidateId: app.candidateId ?? '',
        candidateName,
        vacancyId: app.vacancyId ?? app.vacancy?.id ?? '',
        jobTitle,
        currentStage: app.stage,
        reachedStages,
        outcome,
        ownerName,
        blockerSummary: blocker,
        appliedAt: (app.appliedAt ?? app.createdAt).toISOString(),
        updatedAt: (app.updatedAt ?? app.createdAt).toISOString(),
      };
    });

    const stages = PROGRESSION_STAGES.map((stage) => {
      const reachedCount = records.filter((r) => r.reachedStages.includes(stage)).length;
      return {
        stage,
        label: stage,
        reachedCount,
        pctOfCohort: cohortTotal === 0 ? 0 : Math.round((reachedCount / cohortTotal) * 100),
      };
    });

    const rejectedCount = records.filter((r) => r.outcome === 'REJECTED').length;
    const withdrawnCount = records.filter((r) => r.outcome === 'WITHDRAWN').length;

    return {
      cohortTotal,
      reachedInterview: records.filter((r) => r.reachedStages.includes('Interview')).length,
      joined: records.filter((r) => r.reachedStages.includes('Joined') || r.outcome === 'JOINED').length,
      tooFewToJudge: cohortTotal < 5,
      stages,
      outcomes: [
        {
          outcome: 'REJECTED',
          label: 'Rejected',
          count: rejectedCount,
          pctOfCohort: cohortTotal === 0 ? 0 : Math.round((rejectedCount / cohortTotal) * 100),
        },
        {
          outcome: 'WITHDRAWN',
          label: 'Withdrawn',
          count: withdrawnCount,
          pctOfCohort: cohortTotal === 0 ? 0 : Math.round((withdrawnCount / cohortTotal) * 100),
        },
      ],
      records,
    };
  }

  private buildTimeToHire(
    cohortApps: Array<{
      id: string;
      stage: string;
      appliedAt: Date;
      createdAt: Date;
      statusHistory?: Array<{ fromStage?: string | null; toStage: string; createdAt: Date }>;
    }>,
    openApps: Array<{
      id: string;
      candidateId?: string;
      vacancyId?: string;
      stage: string;
      appliedAt: Date;
      createdAt: Date;
      updatedAt?: Date;
      followUpDate?: Date | null;
      candidate?: { firstName: string; lastName: string } | null;
      vacancy?: { id: string; position?: { title: string } | null } | null;
      primaryRecruiter?: { displayName: string } | null;
      statusHistory?: Array<{ fromStage?: string | null; toStage: string; createdAt: Date }>;
      interviews?: Array<{
        id: string;
        status: string;
        scheduledStart: Date;
        attendees?: Array<{ userId: string; user?: { displayName: string } | null }>;
        scorecards?: Array<{ interviewerId: string; submittedAt?: Date | null }>;
      }>;
      offers?: Array<{
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
        versions?: Array<{ approvals?: OfferApprovalShape[] }>;
      }>;
      hiringCase?: {
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
      } | null;
    }>,
    joinedCases: Array<{
      applicationId?: string;
      actualJoiningDate: Date | null;
      application: {
        id?: string;
        candidateId?: string;
        vacancyId?: string;
        appliedAt?: Date;
        createdAt?: Date;
        candidate?: { firstName: string; lastName: string } | null;
        primaryRecruiter?: { displayName: string } | null;
        vacancy: {
          id?: string;
          branchId: string;
          openedAt: Date | null;
          positionId: string;
          position?: { title: string } | null;
        };
      };
    }>,
    asOfDate: Date,
    user?: AuthUser,
  ): ReportTimeToHire {
    const completedHires: ReportCompletedHireRecord[] = joinedCases.flatMap((hc) => {
      if (!hc.actualJoiningDate) return [];
      const start = hc.application.appliedAt ?? hc.application.createdAt ?? hc.application.vacancy.openedAt;
      if (!start) return [];
      const daysToHire = Math.max(0, Math.round((hc.actualJoiningDate.getTime() - start.getTime()) / DAY_MS));
      const candidateName = hc.application.candidate
        ? `${hc.application.candidate.firstName} ${hc.application.candidate.lastName}`.trim()
        : 'Candidate';
      return [
        {
          applicationId: hc.applicationId ?? hc.application.id ?? '',
          candidateId: hc.application.candidateId ?? '',
          candidateName,
          vacancyId: hc.application.vacancyId ?? hc.application.vacancy.id ?? '',
          jobTitle: hc.application.vacancy.position?.title ?? 'Job',
          appliedAt: start.toISOString(),
          joinedAt: hc.actualJoiningDate.toISOString(),
          daysToHire,
          ownerName: hc.application.primaryRecruiter?.displayName ?? 'Unassigned',
        },
      ];
    });

    const medianDays = computeMedian(completedHires.map((h) => h.daysToHire));

    const stageDurationBuckets = new Map<string, number[]>();
    const trackedStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'];
    for (const s of trackedStages) stageDurationBuckets.set(s, []);

    const allStageApps = [...cohortApps, ...openApps];
    const seenIds = new Set<string>();
    for (const app of allStageApps) {
      if (seenIds.has(app.id)) continue;
      seenIds.add(app.id);
      const history = app.statusHistory ?? [];
      let currentStage = 'Applied';
      let enteredAt = app.appliedAt ?? app.createdAt;
      for (const item of history) {
        const stageKey = item.fromStage || currentStage;
        if (stageDurationBuckets.has(stageKey)) {
          const days = Math.max(0, (item.createdAt.getTime() - enteredAt.getTime()) / DAY_MS);
          stageDurationBuckets.get(stageKey)!.push(days);
        }
        currentStage = item.toStage;
        enteredAt = item.createdAt;
      }
    }

    const stageDurations: ReportStageDuration[] = trackedStages.map((stage) => {
      const samples = stageDurationBuckets.get(stage) ?? [];
      return {
        stage,
        label: stage,
        medianDays: computeMedian(samples),
        sampleSize: samples.length,
      };
    });

    const waitingFiles: ReportWaitingFile[] = openApps
      .map((app) => {
        const history = app.statusHistory ?? [];
        const latestEntry = [...history].reverse().find((h) => h.toStage === app.stage);
        const stageEnteredAt = latestEntry?.createdAt ?? app.appliedAt ?? app.createdAt;
        const waitingDays = Math.max(0, Math.floor((asOfDate.getTime() - stageEnteredAt.getTime()) / DAY_MS));
        const blocker = this.describeBlockerForApp(app, asOfDate, user);
        const candidateName = app.candidate
          ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
          : 'Candidate';
        return {
          applicationId: app.id,
          candidateId: app.candidateId ?? '',
          candidateName,
          vacancyId: app.vacancyId ?? app.vacancy?.id ?? '',
          jobTitle: app.vacancy?.position?.title ?? 'Job',
          stage: app.stage,
          waitingDays,
          thresholdDays: DEFAULT_WAITING_THRESHOLD_DAYS,
          exceedsThreshold: waitingDays > DEFAULT_WAITING_THRESHOLD_DAYS,
          ownerName: app.primaryRecruiter?.displayName ?? 'Unassigned',
          blockerLabel: blocker.blockerLabel,
          blockerKind: blocker.blockerKind,
          interviewId: blocker.interviewId,
          canRemindInterviewer: blocker.canRemindInterviewer,
          canSubmitOwnScorecard: blocker.canSubmitOwnScorecard,
        };
      })
      .sort((a, b) => b.waitingDays - a.waitingDays);

    return {
      medianDays,
      completedHiresCount: completedHires.length,
      filesExceedingThresholdCount: waitingFiles.filter((f) => f.exceedsThreshold).length,
      thresholdDays: DEFAULT_WAITING_THRESHOLD_DAYS,
      stageDurations,
      waitingFiles,
      completedHires,
    };
  }

  private buildSourcePerformance(
    applications: Array<{
      id: string;
      candidateId?: string;
      vacancyId?: string;
      source?: string | null;
      stage: string;
      appliedAt: Date;
      createdAt: Date;
      candidate?: { firstName: string; lastName: string } | null;
      vacancy?: { id: string; position?: { title: string } | null } | null;
      primaryRecruiter?: { displayName: string } | null;
    }>,
    reachedFunnel: ReportReachedFunnel,
  ): ReportSourcePerformance {
    const funnelById = new Map(reachedFunnel.records.map((r) => [r.applicationId, r]));
    const records: ReportSourceRecord[] = applications.map((app) => {
      const funnelRec = funnelById.get(app.id);
      const source = normalizeReportSource(app.source);
      const reachedInterview = funnelRec ? funnelRec.reachedStages.includes('Interview') : false;
      const joined = funnelRec ? funnelRec.reachedStages.includes('Joined') || funnelRec.outcome === 'JOINED' : app.stage === 'Joined';
      const candidateName = app.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
        : 'Candidate';
      return {
        applicationId: app.id,
        candidateId: app.candidateId ?? '',
        candidateName,
        vacancyId: app.vacancyId ?? app.vacancy?.id ?? '',
        jobTitle: app.vacancy?.position?.title ?? 'Job',
        source,
        rawSource: app.source ?? null,
        currentStage: app.stage,
        reachedInterview,
        joined,
        ownerName: app.primaryRecruiter?.displayName ?? 'Unassigned',
        appliedAt: (app.appliedAt ?? app.createdAt).toISOString(),
      };
    });

    const buckets = new Map<string, { applicants: number; reachedInterview: number; joined: number }>();
    for (const rec of records) {
      const current = buckets.get(rec.source) ?? { applicants: 0, reachedInterview: 0, joined: 0 };
      current.applicants += 1;
      if (rec.reachedInterview) current.reachedInterview += 1;
      if (rec.joined) current.joined += 1;
      buckets.set(rec.source, current);
    }

    const sources: ReportSourceOutcome[] = [...buckets.entries()]
      .map(([source, counts]) => ({
        source,
        applicants: counts.applicants,
        reachedInterview: counts.reachedInterview,
        joined: counts.joined,
        interviewRatePct: counts.applicants > 0 ? Math.round((counts.reachedInterview / counts.applicants) * 100) : null,
        hireRatePct: counts.applicants > 0 ? Math.round((counts.joined / counts.applicants) * 100) : null,
        tooFewToJudge: counts.applicants < 5,
      }))
      .sort((a, b) => b.applicants - a.applicants || a.source.localeCompare(b.source));

    return {
      totalApplicants: records.length,
      totalReachedInterview: records.filter((r) => r.reachedInterview).length,
      totalJoined: records.filter((r) => r.joined).length,
      sources,
      records,
    };
  }

  private buildFollowUps(
    openApps: Array<{
      id: string;
      candidateId?: string;
      vacancyId?: string;
      stage: string;
      followUpDate?: Date | null;
      candidate?: { id?: string; firstName: string; lastName: string } | null;
      vacancy?: { id: string; position?: { title: string } | null } | null;
      primaryRecruiter?: { displayName: string } | null;
      statusHistory?: Array<{ createdAt: Date }>;
      notes?: Array<{ createdAt: Date }>;
      screeningLogs?: Array<{ screenedAt: Date }>;
      interviews?: Array<{
        id: string;
        status: string;
        scheduledStart: Date;
        attendees?: Array<{ userId: string; user?: { displayName: string } | null }>;
        scorecards?: Array<{ interviewerId: string; submittedAt?: Date | null }>;
      }>;
      offers?: Array<{
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
        versions?: Array<{ approvals?: OfferApprovalShape[] }>;
      }>;
      hiringCase?: {
        id: string;
        status: string;
        approvals?: OfferApprovalShape[];
      } | null;
    }>,
    openTasks: Array<{
      id: string;
      title: string;
      dueAt: Date | null;
      entityType?: string | null;
      entityId?: string | null;
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
      assignee?: { displayName: string } | null;
      assignedTo?: { displayName: string } | null;
    }>,
    canViewRecruiterTeam: boolean,
    asOfDate: Date,
    user?: AuthUser,
  ): ReportFollowUpsSection {
    const items: ReportFollowUpItem[] = [];
    const appById = new Map(openApps.map((a) => [a.id, a]));
    const appByCandidateId = new Map(
      openApps.filter((a) => Boolean(a.candidateId)).map((a) => [a.candidateId!, a]),
    );

    for (const app of openApps) {
      const candidateName = app.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
        : 'Candidate';
      const jobTitle = app.vacancy?.position?.title ?? 'Job';
      const ownerName = app.primaryRecruiter?.displayName ?? 'Unassigned';

      if (app.followUpDate) {
        const lastNote = app.notes?.[0]?.createdAt;
        const lastScreen = app.screeningLogs?.[0]?.screenedAt;
        const lastHistory = app.statusHistory?.length
          ? app.statusHistory[app.statusHistory.length - 1]!.createdAt
          : undefined;
        const actedAfterDue = [lastNote, lastScreen, lastHistory].some(
          (dt) => dt && dt.getTime() >= app.followUpDate!.getTime(),
        );
        if (!actedAfterDue) {
          const isOverdue = app.followUpDate.getTime() < asOfDate.getTime();
          items.push({
            id: `app-followup-${app.id}`,
            kind: 'APPLICATION_FOLLOW_UP',
            kindLabel: 'Application follow-up',
            candidateId: app.candidateId ?? null,
            candidateName,
            applicationId: app.id,
            vacancyId: app.vacancyId ?? app.vacancy?.id ?? null,
            jobTitle,
            stage: app.stage,
            responsibleName: ownerName,
            dueAt: app.followUpDate.toISOString(),
            isOverdue,
            summary: isOverdue
              ? `Application follow-up overdue in ${app.stage}`
              : `Scheduled application follow-up in ${app.stage}`,
          });
        }
      }

      for (const iv of app.interviews ?? []) {
        const isPastOrCompleted =
          iv.status === 'Completed' || (iv.status === 'Scheduled' && iv.scheduledStart <= asOfDate);
        if (!isPastOrCompleted) continue;
        const submittedIds = new Set(
          (iv.scorecards ?? []).filter((sc) => sc.submittedAt !== null).map((sc) => sc.interviewerId),
        );
        const pendingAttendees = (iv.attendees ?? []).filter((att) => !submittedIds.has(att.userId));
        if (pendingAttendees.length > 0) {
          const pendingNames = pendingAttendees.map((a) => a.user?.displayName || 'Interviewer').join(', ');
          const pendingIds = pendingAttendees.map((a) => a.userId);
          const canSubmitOwnScorecard = Boolean(user && pendingIds.includes(user.userId));
          const canRemindInterviewer = Boolean(
            pendingIds.length > 0 && (!user || pendingIds.some((id) => id !== user.userId)),
          );
          items.push({
            id: `scorecard-${iv.id}`,
            kind: 'PENDING_SCORECARD',
            kindLabel: 'Pending scorecard',
            candidateId: app.candidateId ?? null,
            candidateName,
            applicationId: app.id,
            vacancyId: app.vacancyId ?? app.vacancy?.id ?? null,
            jobTitle,
            stage: app.stage,
            responsibleName: pendingNames,
            dueAt: iv.scheduledStart.toISOString(),
            isOverdue: iv.scheduledStart.getTime() < asOfDate.getTime(),
            summary: `Scorecard pending from ${pendingNames}`,
            interviewId: iv.id,
            canRemindInterviewer,
            canSubmitOwnScorecard,
          });
        }
      }

      for (const offer of app.offers ?? []) {
        const approvals = extractOfferApprovals(offer);
        const pendingApprovals = approvals.filter((a) => a.status === 'Pending');
        if (offer.status === 'Pending Approval' || pendingApprovals.length > 0) {
          const approverNames =
            pendingApprovals.map((a) => a.approver?.displayName).filter(Boolean).join(', ') || 'Approver';
          items.push({
            id: `offer-approval-${offer.id}`,
            kind: 'AWAITING_APPROVAL',
            kindLabel: 'Offer approval',
            candidateId: app.candidateId ?? null,
            candidateName,
            applicationId: app.id,
            vacancyId: app.vacancyId ?? app.vacancy?.id ?? null,
            jobTitle,
            stage: app.stage,
            responsibleName: approverNames,
            dueAt: null,
            isOverdue: false,
            summary: `Offer awaiting approval from ${approverNames}`,
          });
        }
      }

      const pendingHcApprovals = (app.hiringCase?.approvals ?? []).filter((a) => a.status === 'Pending');
      if (pendingHcApprovals.length > 0 && app.hiringCase) {
        const approverNames =
          pendingHcApprovals.map((a) => a.approver?.displayName).filter(Boolean).join(', ') || 'Approver';
        items.push({
          id: `hiring-approval-${app.hiringCase.id}`,
          kind: 'AWAITING_APPROVAL',
          kindLabel: 'Offer approval',
          candidateId: app.candidateId ?? null,
          candidateName,
          applicationId: app.id,
          vacancyId: app.vacancyId ?? app.vacancy?.id ?? null,
          jobTitle,
          stage: app.stage,
          responsibleName: approverNames,
          dueAt: null,
          isOverdue: false,
          summary: `Final hiring approval pending from ${approverNames}`,
        });
      }
    }

    for (const task of openTasks) {
      const eType = (task.entityType ?? task.relatedEntityType ?? '').toLowerCase();
      const eId = task.entityId ?? task.relatedEntityId ?? null;
      const linkedApp =
        eType === 'application' && eId
          ? appById.get(eId)
          : eType === 'candidate' && eId
          ? appByCandidateId.get(eId)
          : undefined;
      const candidateName = linkedApp?.candidate
        ? `${linkedApp.candidate.firstName} ${linkedApp.candidate.lastName}`.trim()
        : task.title;
      const isOverdue = Boolean(task.dueAt && task.dueAt.getTime() < asOfDate.getTime());
      items.push({
        id: `person-task-${task.id}`,
        kind: 'PERSON_FOLLOW_UP',
        kindLabel: 'Person follow-up',
        candidateId: eType === 'candidate' ? eId : linkedApp?.candidateId ?? null,
        candidateName,
        applicationId: linkedApp?.id ?? (eType === 'application' ? eId : null),
        vacancyId: linkedApp?.vacancyId ?? linkedApp?.vacancy?.id ?? null,
        jobTitle: linkedApp?.vacancy?.position?.title ?? null,
        stage: linkedApp?.stage ?? null,
        responsibleName: task.assignee?.displayName ?? task.assignedTo?.displayName ?? 'Assigned owner',
        dueAt: task.dueAt ? task.dueAt.toISOString() : null,
        isOverdue,
        summary: task.title,
        taskId: task.id,
      });
    }

    items.sort((a, b) => {
      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.candidateName.localeCompare(b.candidateName);
    });

    const overdueFollowUpsCount = items.filter(
      (i) => (i.kind === 'APPLICATION_FOLLOW_UP' || i.kind === 'PERSON_FOLLOW_UP') && i.isOverdue,
    ).length;
    const pendingFeedbackCount = items.filter((i) => i.kind === 'PENDING_SCORECARD').length;
    const awaitingApprovalCount = items.filter((i) => i.kind === 'AWAITING_APPROVAL').length;

    return {
      scopeLabel: canViewRecruiterTeam ? 'Team follow-ups' : 'My follow-ups',
      overdueFollowUpsCount,
      pendingFeedbackCount,
      awaitingApprovalCount,
      items,
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
        [],
        ['Metric', 'Current', ''],
        ['Applications', currentTotals.applications, ''],
        ['Interviews', currentTotals.interviews, ''],
        ['Offers', currentTotals.offers, ''],
        ['Joined', currentTotals.joined, ''],
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
      // Meeting notes 2026-11-25 (item 5): branch breakdown in the export.
      const byEntity = await this.getByEntity(organizationId, query, user);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Entity (Branch)', 'Applications', 'Hires', 'Time to fill (days)', 'Open vacancies', 'Approved headcount', 'Joined headcount', 'Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'],
        ...byEntity.map((row) => [
          row.entityName,
          row.applications,
          row.hires,
          row.timeToFillDays ?? '',
          row.openVacancies,
          row.approvedHeadcount,
          row.joinedHeadcount,
          ...row.funnel.map((stage) => stage.count),
        ]),
      ]), 'By entity');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.funnel.map((stage) => ({
        stage: stage.name,
        count: stage.count,
        percentOfApplications: stage.percent,
        conversionFromPrevious: stage.conversionRate ?? 'Not comparable',
      }))), 'Funnel');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.hiringByPosition), 'Hiring by Position');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview.recruiterWorkload.map((recruiter) => ({
        recruiter: recruiter.name,
        openPositions: recruiter.vacancies,
        applicationsOwned: recruiter.applications,
        overdueTasks: recruiter.overdueTasks,
      }))), 'Recruiter Workload');
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw exportFailed('The report could not be exported. Please try again.');
    }
  }

  private resolveRange(query: ReportOverviewQueryDto): ResolvedReportRange {
    if (query.month) {
      const mr = monthRange(query.month, new Date());
      if (!mr) throw new BadRequestException('month must be YYYY-MM.');
      return { from: mr.from, to: mr.to };
    }
    const to = query.to ? parseCairoDateBound(query.to, 'end') : new Date();
    const from = query.from ? parseCairoDateBound(query.from, 'start') : new Date(to.getTime() - (29 * DAY_MS));
    if (from > to) throw new BadRequestException('Report start date must be before the end date.');

    return { from, to };
  }

  /** Report filters are ANDed with the access scope; a filter never replaces the scope. */
  private applicationRelationFilter(
    query: ReportOverviewQueryDto,
    visibility?: Prisma.ApplicationWhereInput,
  ): Prisma.ApplicationWhereInput {
    const filters: Prisma.ApplicationWhereInput[] = [visibility ?? {}];
    if (query.vacancyId) filters.push({ vacancyId: query.vacancyId });
    if (query.recruiterId) filters.push({ primaryRecruiterId: query.recruiterId });
    if (query.branchId) filters.push({ vacancy: { branchId: query.branchId } });
    if (query.positionId) filters.push({ vacancy: { positionId: query.positionId } });
    return { AND: filters };
  }

  private applicationWhere(
    organizationId: string,
    from: Date,
    to: Date,
    query: ReportOverviewQueryDto,
    visibility?: Prisma.ApplicationWhereInput,
  ): Prisma.ApplicationWhereInput {
    return { AND: [{ organizationId, createdAt: { gte: from, lt: to } }, this.applicationRelationFilter(query, visibility)] };
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

    for (let start = from.getTime(); start < to.getTime(); start += bucketMs) {
      const end = Math.min(to.getTime(), start + bucketMs);
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

  async getKpis(organizationId: string, user?: AuthUser, query: ReportOverviewQueryDto = {}): Promise<ReportKpis> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    // Meeting notes 2026-11-25 (item 5): branch filter across the KPIs.
    const scoped = this.branchScopedVisibility(query, visibility);
    const [applications, offers, interviews, joinedCases] = await Promise.all([
      this.prisma.application.findMany({
        where: scoped,
        select: { source: true, stage: true, createdAt: true },
      }),
      this.prisma.offer.findMany({
        where: { organizationId, application: scoped },
        select: {
          status: true,
          createdAt: true,
          application: { select: { createdAt: true } },
        },
      }),
      this.prisma.interview.findMany({
        where: { organizationId, application: scoped },
        select: { status: true },
      }),
      this.prisma.hiringCase.findMany({
        where: { organizationId, status: 'Joined', application: scoped },
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
      const source = normalizeReportSource(application.source);
      const current = sourceCounts.get(source) ?? { total: 0, joined: 0 };
      current.total += 1;
      if (application.stage === 'Joined') current.joined += 1;
      sourceCounts.set(source, current);
    }
    const topSourceEntry = [...sourceCounts.entries()].sort((a, b) => b[1].total - a[1].total)[0];

    return {
      timeToFill: { value: averageTimeToFill },
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

  async getFunnel(organizationId: string, user?: AuthUser, query: ReportOverviewQueryDto = {}): Promise<FunnelStage[]> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    // Meeting notes 2026-11-25 (item 5): branch filter across the funnel.
    const grouped = await this.prisma.application.groupBy({
      by: ['stage'],
      where: this.branchScopedVisibility(query, visibility),
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

  async getHiringByDepartment(organizationId: string, user?: AuthUser, query: ReportOverviewQueryDto = {}): Promise<DepartmentHiring[]> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const vacancies = await this.prisma.vacancy.findMany({
      // Meeting notes 2026-11-25 (item 5): branch filter across the department hiring report.
      where: { organizationId, ...(query.branchId ? { branchId: query.branchId } : {}), applications: { some: visibility } },
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

  async getRecruiterWorkload(organizationId: string, user?: AuthUser, query: ReportOverviewQueryDto = {}): Promise<RecruiterWorkload[]> {
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const scoped = this.branchScopedVisibility(query, visibility);
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'Active' },
      select: {
        id: true,
        displayName: true,
        _count: { select: { primaryApplications: { where: scoped }, assignments: { where: { isActive: true } } } },
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

  /**
   * Meeting notes 2026-11-25 (item 5): per-entity (per-branch) report — hires,
   * funnel and time-to-fill for every branch in the org. ENTITY = BRANCH, the
   * system's org subunit. A `branchId` query narrows the report to one branch.
   * Time-to-fill follows the KPIs definition (hiring-case creation → actual
   * joining); null when a branch has no hires in range.
   */
  async getByEntity(organizationId: string, query: ReportOverviewQueryDto, user?: AuthUser): Promise<EntityReport[]> {
    const range = this.resolveRange(query);
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const applicationWhere = this.applicationWhere(organizationId, range.from, range.to, query, visibility);
    const [branches, applications, joinedCases, vacancies] = await Promise.all([
      this.prisma.branch.findMany({
        where: { organizationId, ...(query.branchId ? { id: query.branchId } : {}) },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.application.findMany({
        where: applicationWhere,
        select: { stage: true, vacancy: { select: { branchId: true } } },
      }),
      this.prisma.hiringCase.findMany({
        where: {
          organizationId,
          status: 'Joined',
          application: this.applicationRelationFilter(query, visibility),
        },
        select: {
          actualJoiningDate: true,
          createdAt: true,
          application: { select: { vacancy: { select: { branchId: true } } } },
        },
      }),
      this.prisma.vacancy.findMany({
        where: { organizationId, ...(query.branchId ? { branchId: query.branchId } : {}) },
        select: { branchId: true, status: true, approvedHeadcount: true, joinedHeadcount: true },
      }),
    ]);

    const stages = [...PROGRESSION_STAGES];
    const rows = new Map<string, EntityReport>();
    for (const branch of branches) {
      rows.set(branch.id, {
        entityId: branch.id,
        entityName: branch.name,
        entityCode: branch.code ?? null,
        applications: 0,
        hires: 0,
        funnel: stages.map((name) => ({ name, count: 0, percent: 0 })),
        timeToFillDays: null,
        openVacancies: 0,
        approvedHeadcount: 0,
        joinedHeadcount: 0,
      });
    }
    const fillDays = new Map<string, number[]>();
    for (const application of applications) {
      const row = rows.get(application.vacancy.branchId);
      if (!row) continue;
      row.applications += 1;
      const stage = row.funnel.find((s) => s.name === application.stage);
      if (stage) stage.count += 1;
    }
    for (const joinedCase of joinedCases) {
      const branchId = joinedCase.application.vacancy.branchId;
      const row = rows.get(branchId);
      if (!row) continue;
      const hireDate = joinedCase.actualJoiningDate ?? joinedCase.createdAt;
      if (hireDate < range.from || hireDate >= range.to) continue;
      row.hires += 1;
      const end = joinedCase.actualJoiningDate ?? joinedCase.createdAt;
      const days = Math.max(0, Math.round((end.getTime() - joinedCase.createdAt.getTime()) / DAY_MS));
      const list = fillDays.get(branchId) ?? [];
      list.push(days);
      fillDays.set(branchId, list);
    }
    for (const vacancy of vacancies) {
      const row = rows.get(vacancy.branchId);
      if (!row) continue;
      if (['Open', 'Partially Filled'].includes(vacancy.status)) row.openVacancies += 1;
      row.approvedHeadcount += vacancy.approvedHeadcount;
      row.joinedHeadcount += vacancy.joinedHeadcount;
    }
    for (const row of rows.values()) {
      const applied = row.funnel.find((s) => s.name === 'Applied')?.count ?? 0;
      for (const stage of row.funnel) {
        stage.percent = applied === 0 ? 0 : Math.round((stage.count / applied) * 100);
      }
      const days = fillDays.get(row.entityId) ?? [];
      row.timeToFillDays = days.length === 0 ? null : Math.max(0, Math.round(days.reduce((a, b) => a + b, 0) / days.length));
    }
    return [...rows.values()];
  }

  /** Meeting notes 2026-11-25 (item 5): a branchId filter never replaces the access scope. */
  private branchScopedVisibility(query: ReportOverviewQueryDto, visibility: Prisma.ApplicationWhereInput): Prisma.ApplicationWhereInput {
    return query.branchId ? { AND: [visibility, { vacancy: { branchId: query.branchId } }] } : visibility;
  }

  /**
   * Ticket 07: Vacancy Tracker report.
   * - Enforces role/team visibility scope alongside identical filters (from/to/branch/department/owner).
   * - Separates open requests count from requested/filled/remaining seats.
   * - Omits any replaced-employee column (Ticket 03).
   * - Vacant Days starts from vacancy activation (`activatedAt`), returning null when not yet activated.
   */
  async getVacancyTracker(organizationId: string, query: ReportOverviewQueryDto, user?: AuthUser) {
    const range = this.resolveRange(query);
    const ownerFilter = query.ownerId ?? query.recruiterId;
    const isAdmin = !user || (user.roleCodes ?? []).includes('ADMINISTRATOR');

    let allowedOwnerIds: string[] | null = null;
    if (!isAdmin && user) {
      const isManager = (user.roleCodes ?? []).some((code) => ['HIRING_MANAGER', 'TALENT_MANAGER', 'HR_MANAGER'].includes(code));
      if (isManager && typeof this.prisma.user?.findMany === 'function') {
        const directAndOrg = await this.prisma.user.findMany({
          where: { organizationId, status: 'Active' },
          select: { id: true, managerId: true },
        });
        const team = new Set<string>([user.userId]);
        let added = true;
        while (added) {
          added = false;
          for (const u of directAndOrg) {
            if (u.managerId && team.has(u.managerId) && !team.has(u.id)) {
              team.add(u.id);
              added = true;
            }
          }
        }
        allowedOwnerIds = [...team];
      } else {
        allowedOwnerIds = [user.userId];
      }
    }

    const where: Prisma.VacancyRequestWhereInput = {
      organizationId,
      createdAt: { gte: range.from, lt: range.to },
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
      ...(ownerFilter ? {
        OR: [
          { requesterId: ownerFilter },
          { assignedEmployeeId: ownerFilter },
          { vacancy: { primaryRecruiterId: ownerFilter } },
        ],
      } : {}),
      ...(allowedOwnerIds ? {
        AND: [{
          OR: [
            { requesterId: { in: allowedOwnerIds } },
            { assignedEmployeeId: { in: allowedOwnerIds } },
            { vacancy: { primaryRecruiterId: { in: allowedOwnerIds } } },
          ],
        }],
      } : {}),
    };

    const requests = await this.prisma.vacancyRequest.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        requester: { select: { id: true, displayName: true } },
        assignedEmployee: { select: { id: true, displayName: true } },
        approvals: {
          where: { status: 'Approved' },
          orderBy: { decidedAt: 'desc' },
          take: 1,
          select: { decidedAt: true },
        },
        vacancy: {
          select: {
            id: true,
            vacancyCode: true,
            status: true,
            approvedHeadcount: true,
            joinedHeadcount: true,
            openedAt: true,
            updatedAt: true,
            primaryRecruiter: { select: { id: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const CLOSED_REQUEST_STATUSES = new Set(['Rejected', 'Cancelled', 'Closed', 'Filled']);
    const CLOSED_VACANCY_STATUSES = new Set(['Filled', 'Closed', 'Cancelled']);

    const rows = requests.map((req) => {
      const vac = req.vacancy;
      const requestedSeats = vac?.approvedHeadcount ?? req.requestedHeadcount ?? 1;
      const filledSeats = vac?.joinedHeadcount ?? 0;
      const remainingSeats = Math.max(0, requestedSeats - filledSeats);
      const effectiveStatus = vac?.status ?? req.status;
      const isOpen = !CLOSED_REQUEST_STATUSES.has(req.status) && (!vac || !CLOSED_VACANCY_STATUSES.has(vac.status));
      const activatedAt = vac?.openedAt ?? req.activatedAt ?? null;
      const endRef = vac && CLOSED_VACANCY_STATUSES.has(vac.status) ? vac.updatedAt : now;
      const vacantDays = activatedAt
        ? Math.max(0, Math.floor((endRef.getTime() - activatedAt.getTime()) / DAY_MS))
        : null;
      const approvedAt = req.approvals?.[0]?.decidedAt ?? null;

      return {
        requestId: req.id,
        requestCode: req.requestCode,
        vacancyId: vac?.id ?? null,
        vacancyCode: vac?.vacancyCode ?? null,
        positionTitle: req.position?.title ?? 'Untitled position',
        branchId: req.branchId,
        branchName: req.branch?.name ?? '',
        departmentId: req.departmentId,
        departmentName: req.department?.name ?? '',
        openingType: req.openingType,
        ownerName: vac?.primaryRecruiter?.displayName ?? req.assignedEmployee?.displayName ?? req.requester?.displayName ?? 'Unassigned',
        status: effectiveStatus,
        isOpen,
        approvedAt: approvedAt ? approvedAt.toISOString() : null,
        activatedAt: activatedAt ? activatedAt.toISOString() : null,
        requestedSeats,
        filledSeats,
        remainingSeats,
        vacantDays,
      };
    });

    const openRequestsCount = rows.filter((r) => r.isOpen).length;
    const totalRequestedSeats = rows.reduce((sum, r) => sum + r.requestedSeats, 0);
    const totalFilledSeats = rows.reduce((sum, r) => sum + r.filledSeats, 0);
    const totalRemainingSeats = rows.reduce((sum, r) => sum + r.remainingSeats, 0);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      summary: {
        totalRequestsCount: rows.length,
        openRequestsCount,
        totalRequestedSeats,
        totalFilledSeats,
        totalRemainingSeats,
      },
      rows,
    };
  }

  async exportVacancyTrackerExcel(organizationId: string, query: ReportOverviewQueryDto, user?: AuthUser): Promise<Buffer> {
    try {
      const tracker = await this.getVacancyTracker(organizationId, query, user);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Vacancy Tracker Summary'],
        ['From', tracker.range.from],
        ['To', tracker.range.to],
        [],
        ['Total requests', tracker.summary.totalRequestsCount],
        ['Open requests', tracker.summary.openRequestsCount],
        ['Requested seats', tracker.summary.totalRequestedSeats],
        ['Filled seats', tracker.summary.totalFilledSeats],
        ['Remaining seats', tracker.summary.totalRemainingSeats],
      ]), 'Summary');

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        [
          'Request Code',
          'Vacancy Code',
          'Position',
          'Branch',
          'Department',
          'Opening Type',
          'Owner',
          'Status',
          'Approved Date',
          'Activated Date',
          'Requested Seats',
          'Filled Seats',
          'Remaining Seats',
          'Vacant Days',
        ],
        ...tracker.rows.map((r) => [
          r.requestCode,
          r.vacancyCode ?? '',
          r.positionTitle,
          r.branchName,
          r.departmentName,
          r.openingType,
          r.ownerName,
          r.status,
          r.approvedAt ? r.approvedAt.slice(0, 10) : '',
          r.activatedAt ? r.activatedAt.slice(0, 10) : '',
          r.requestedSeats,
          r.filledSeats,
          r.remainingSeats,
          r.vacantDays ?? '',
        ]),
      ]), 'Vacancy Tracker');
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw exportFailed('Could not export Vacancy Tracker report.');
    }
  }

  /**
   * Ticket 07: Candidate Activity report.
   * - Unit = application; each application is counted AT MOST ONCE per stage reached in [from, to).
   * - Rescheduled interviews and resent offers never double-count the same application.
   * - Same filters and role visibility scope apply to totals, source breakdown, drill-down rows, and Excel export.
   */
  async getCandidateActivity(organizationId: string, query: ReportOverviewQueryDto, user?: AuthUser) {
    const range = this.resolveRange(query);
    const visibility = user && this.accessControl
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };

    const effectiveRecruiterId = query.ownerId ?? query.recruiterId;
    const effectiveQuery: ReportOverviewQueryDto = {
      ...query,
      ...(effectiveRecruiterId ? { recruiterId: effectiveRecruiterId } : {}),
    };

    const relationFilters: Prisma.ApplicationWhereInput[] = [this.applicationRelationFilter(effectiveQuery, visibility)];
    if (query.departmentId) {
      relationFilters.push({ vacancy: { vacancyRequest: { departmentId: query.departmentId } } });
    }

    const applications = await this.prisma.application.findMany({
      where: {
        AND: [{ organizationId }, ...relationFilters],
      },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        primaryRecruiter: { select: { displayName: true } },
        vacancy: {
          include: {
            position: { select: { title: true } },
            branch: { select: { id: true, name: true } },
            vacancyRequest: { select: { department: { select: { name: true } } } },
          },
        },
        statusHistory: { select: { toStage: true, createdAt: true } },
        screeningLogs: { select: { screenedAt: true } },
        interviews: {
          where: { status: { not: 'Cancelled' } },
          select: { interviewType: true, stageContext: true, scheduledStart: true, createdAt: true },
        },
        offers: {
          select: {
            status: true,
            updatedAt: true,
            versions: { select: { sentAt: true, sendDates: true } },
          },
        },
        hiringCase: { select: { status: true, actualJoiningDate: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });

    const inRange = (d?: Date | string | null): boolean => {
      if (!d) return false;
      const dt = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(dt.getTime())) return false;
      return dt >= range.from && dt < range.to;
    };

    const rows = [];
    const bySourceMap = new Map<string, { source: string; applied: number; screening: number; interviews: number; offerSent: number; joined: number }>();
    const declineReasonsMap = new Map<string, number>();

    for (const app of applications) {
      const applied = inRange(app.appliedAt ?? app.createdAt);
      const screening = (app.screeningLogs ?? []).some((s) => inRange(s.screenedAt))
        || (app.statusHistory ?? []).some((h) => h.toStage === 'Screening' && inRange(h.createdAt));

      const hrInterview = (app.interviews ?? []).some(
        (iv) => (iv.interviewType === 'HR' || iv.interviewType === 'Behavioral' || iv.interviewType === 'Screening')
          && iv.stageContext !== 'Pre-Hire'
          && (inRange(iv.scheduledStart) || inRange(iv.createdAt)),
      );
      const technicalInterview = (app.interviews ?? []).some(
        (iv) => (iv.interviewType === 'Technical' || iv.interviewType === 'Managerial')
          && iv.stageContext !== 'Pre-Hire'
          && (inRange(iv.scheduledStart) || inRange(iv.createdAt)),
      );
      const assessmentInterview = (app.interviews ?? []).some(
        (iv) => (iv.stageContext === 'Pre-Hire' || iv.interviewType === 'Assessment')
          && (inRange(iv.scheduledStart) || inRange(iv.createdAt)),
      );
      const anyInterview = hrInterview || technicalInterview || assessmentInterview
        || (app.statusHistory ?? []).some((h) => h.toStage === 'Interview' && inRange(h.createdAt));

      const offerSent = (app.offers ?? []).some((o) => (o.versions ?? []).some((v) => inRange(v.sentAt) || v.sendDates?.some(inRange)));

      const declinedOffer = (app.offers ?? []).find((o) => o.status === 'Declined' && inRange(o.updatedAt));
      const offerDeclined = Boolean(declinedOffer);
      const declineReason = offerDeclined ? (app.rejectionReason?.trim() || 'Declined offer') : null;

      const joined = Boolean(
        (app.hiringCase?.status === 'Joined' && inRange(app.hiringCase.actualJoiningDate))
        || (app.statusHistory ?? []).some((h) => h.toStage === 'Joined' && inRange(h.createdAt)),
      );

      if (!applied && !screening && !anyInterview && !offerSent && !offerDeclined && !joined) {
        continue;
      }

      const source = normalizeReportSource(app.source);
      const bucket = bySourceMap.get(source) ?? { source, applied: 0, screening: 0, interviews: 0, offerSent: 0, joined: 0 };
      if (applied) bucket.applied += 1;
      if (screening) bucket.screening += 1;
      if (anyInterview) bucket.interviews += 1;
      if (offerSent) bucket.offerSent += 1;
      if (joined) bucket.joined += 1;
      bySourceMap.set(source, bucket);

      if (offerDeclined && declineReason) {
        declineReasonsMap.set(declineReason, (declineReasonsMap.get(declineReason) ?? 0) + 1);
      }

      rows.push({
        applicationId: app.id,
        applicationCode: app.applicationCode,
        candidateName: `${app.candidate.firstName} ${app.candidate.lastName}`.trim(),
        positionTitle: app.vacancy.position?.title ?? '',
        branchName: app.vacancy.branch?.name ?? '',
        departmentName: app.vacancy.vacancyRequest?.department?.name ?? app.vacancy.department ?? '',
        source,
        ownerName: app.primaryRecruiter?.displayName ?? 'Unassigned',
        currentStage: app.stage,
        appliedAt: (app.appliedAt ?? app.createdAt).toISOString(),
        applied,
        reachedScreening: screening,
        reachedHrInterview: hrInterview,
        reachedTechnicalInterview: technicalInterview,
        reachedAssessmentInterview: assessmentInterview,
        offerSent,
        offerDeclined,
        declineReason,
        joined,
        joinedAt: app.hiringCase?.actualJoiningDate ? app.hiringCase.actualJoiningDate.toISOString() : null,
      });
    }

    const totals = {
      applications: rows.length,
      applied: rows.filter((r) => r.applied).length,
      screening: rows.filter((r) => r.reachedScreening).length,
      hrInterview: rows.filter((r) => r.reachedHrInterview).length,
      technicalInterview: rows.filter((r) => r.reachedTechnicalInterview).length,
      assessmentInterview: rows.filter((r) => r.reachedAssessmentInterview).length,
      offerSent: rows.filter((r) => r.offerSent).length,
      offerDeclined: rows.filter((r) => r.offerDeclined).length,
      joined: rows.filter((r) => r.joined).length,
    };

    const bySource = [...bySourceMap.values()].sort((a, b) => b.applied - a.applied || a.source.localeCompare(b.source));
    const declineReasons = [...declineReasonsMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals,
      bySource,
      declineReasons,
      rows,
    };
  }

  async exportCandidateActivityExcel(organizationId: string, query: ReportOverviewQueryDto, user?: AuthUser): Promise<Buffer> {
    try {
      const activity = await this.getCandidateActivity(organizationId, query, user);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Candidate Activity Summary'],
        ['From', activity.range.from],
        ['To', activity.range.to],
        [],
        ['Metric', 'Unique Applications'],
        ['Active Applications in Period', activity.totals.applications],
        ['Applied', activity.totals.applied],
        ['Screening', activity.totals.screening],
        ['HR / Behavioral Interview', activity.totals.hrInterview],
        ['Technical / Managerial Interview', activity.totals.technicalInterview],
        ['Pre-Hire Assessment Interview', activity.totals.assessmentInterview],
        ['Offer Sent', activity.totals.offerSent],
        ['Offer Declined', activity.totals.offerDeclined],
        ['Joined', activity.totals.joined],
      ]), 'Summary');

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Source', 'Applied', 'Screening', 'Interviews', 'Offer Sent', 'Joined'],
        ...activity.bySource.map((s) => [s.source, s.applied, s.screening, s.interviews, s.offerSent, s.joined]),
      ]), 'By Source');

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        [
          'Application Code',
          'Candidate',
          'Position',
          'Branch',
          'Department',
          'Source',
          'Owner',
          'Current Stage',
          'Applied',
          'Screening',
          'HR Interview',
          'Technical Interview',
          'Assessment Interview',
          'Offer Sent',
          'Offer Declined',
          'Decline Reason',
          'Joined',
        ],
        ...activity.rows.map((r) => [
          r.applicationCode,
          r.candidateName,
          r.positionTitle,
          r.branchName,
          r.departmentName,
          r.source,
          r.ownerName,
          r.currentStage,
          r.applied ? 'Yes' : 'No',
          r.reachedScreening ? 'Yes' : 'No',
          r.reachedHrInterview ? 'Yes' : 'No',
          r.reachedTechnicalInterview ? 'Yes' : 'No',
          r.reachedAssessmentInterview ? 'Yes' : 'No',
          r.offerSent ? 'Yes' : 'No',
          r.offerDeclined ? 'Yes' : 'No',
          r.declineReason ?? '',
          r.joined ? 'Yes' : 'No',
        ]),
      ]), 'Candidate Activity');
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw exportFailed('Could not export Candidate Activity report.');
    }
  }
}
