import { ForbiddenException, Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Prisma } from '@recruitflow/database';
import { applicationOwnershipWhere, loadAccessProfile, vacancyFullAccessWhere } from '../common/access/file-access';
import type {
  AuthUser,
  GlobalSearchGroup,
  GlobalSearchResponse,
} from '@recruitflow/contracts';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async search(user: AuthUser, rawQuery: string, requestedLimit = 5): Promise<GlobalSearchResponse> {
    const query = rawQuery.trim();
    const limit = Math.min(10, Math.max(1, requestedLimit));
    const permissions = await this.getPermissions(user);
    const groupPromises: Array<Promise<GlobalSearchGroup>> = [];
    // B1 security: search uses the same scope as the lists. Other owners' files are excluded,
    // other owners' jobs are redacted to title/site/seats, and non-owners get no contact fields.
    const profile = await loadAccessProfile(this.prisma, user);

    if (permissions.has('CANDIDATE_VIEW')) {
      groupPromises.push(this.searchCandidates(user, profile.isOversight, query, limit));
    }
    if (permissions.has('VACANCY_VIEW')) {
      groupPromises.push(this.searchVacancies(user, profile.isOversight, query, limit));
    }
    if (permissions.has('APPLICATION_VIEW')) {
      groupPromises.push(this.searchApplications(user, query, limit));
    }
    if (permissions.has('TASK_VIEW')) {
      groupPromises.push(this.searchTasks(user.organizationId, user.userId, query, limit));
    }

    const groups = (await Promise.all(groupPromises)).filter((group) => group.items.length > 0);
    return {
      query,
      groups,
      total: groups.reduce((total, group) => total + group.items.length, 0),
    };
  }

  private async getPermissions(user: AuthUser): Promise<Set<string>> {
    const record = await this.prisma.user.findFirst({
      where: {
        id: user.userId,
        organizationId: user.organizationId,
        status: 'Active',
      },
      select: {
        userRoles: {
          where: { role: { status: 'Active' } },
          select: {
            role: {
              select: {
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!record) {
      throw new ForbiddenException('Access denied: active user context is unavailable');
    }

    return new Set(record.userRoles.flatMap((link) =>
      link.role.permissions.map((permissionLink) => permissionLink.permission.code),
    ));
  }

  /** Candidates whose contact details the caller may see: oversight, the creator, or the owner of one of their files. */
  private contactOwnerWhere(user: AuthUser): Prisma.CandidateWhereInput {
    return { OR: [{ createdById: user.userId }, { applications: { some: applicationOwnershipWhere(user.userId) } }] };
  }

  private async searchCandidates(user: AuthUser, oversight: boolean, query: string, limit: number): Promise<GlobalSearchGroup> {
    const scope = await this.accessControl.getCandidateVisibilityWhere(user);
    const owned = oversight ? {} : this.contactOwnerWhere(user);
    const candidates = await this.prisma.candidate.findMany({
      where: {
        AND: [
          scope,
          { organizationId: user.organizationId },
          {
            OR: [
              { candidateCode: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { currentTitle: { contains: query, mode: 'insensitive' } },
              // Matching on contact data is only allowed where the caller may see it (no email oracle).
              { AND: [owned, { OR: [{ email: { contains: query, mode: 'insensitive' } }, { phone: { contains: query, mode: 'insensitive' } }] }] },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, candidateCode: true, firstName: true, lastName: true, currentTitle: true, email: true, status: true },
    });
    const contactIds = oversight
      ? new Set(candidates.map((c) => c.id))
      : new Set((await this.prisma.candidate.findMany({
        where: { AND: [{ id: { in: candidates.map((c) => c.id) } }, owned] },
        select: { id: true },
      })).map((c) => c.id));

    return {
      entityType: 'candidate',
      label: 'Candidates',
      items: candidates.map((candidate) => ({
        entityType: 'candidate',
        entityId: candidate.id,
        title: `${candidate.firstName} ${candidate.lastName}`,
        subtitle: [candidate.currentTitle, candidate.candidateCode, contactIds.has(candidate.id) ? candidate.email : null].filter(Boolean).join(' · '),
        status: candidate.status,
      })),
    };
  }

  private async searchVacancies(user: AuthUser, oversight: boolean, query: string, limit: number): Promise<GlobalSearchGroup> {
    const scope = await this.accessControl.getVacancyScopeWhere(user);
    const full = oversight ? {} : vacancyFullAccessWhere(user.userId);
    const vacancies = await this.prisma.vacancy.findMany({
      where: {
        AND: [
          scope,
          { organizationId: user.organizationId },
          {
            OR: [
              { AND: [full, { vacancyCode: { contains: query, mode: 'insensitive' } }] },
              { position: { title: { contains: query, mode: 'insensitive' } } },
              { branch: { name: { contains: query, mode: 'insensitive' } } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true, vacancyCode: true, status: true, approvedHeadcount: true, joinedHeadcount: true,
        position: { select: { title: true } }, branch: { select: { name: true } },
      },
    });
    const fullIds = oversight
      ? new Set(vacancies.map((v) => v.id))
      : new Set((await this.prisma.vacancy.findMany({ where: { AND: [{ id: { in: vacancies.map((v) => v.id) } }, full] }, select: { id: true } })).map((v) => v.id));

    return {
      entityType: 'vacancy',
      label: 'Openings',
      items: vacancies.map((vacancy) => fullIds.has(vacancy.id)
        ? { entityType: 'vacancy' as const, entityId: vacancy.id, title: vacancy.position.title, subtitle: `${vacancy.vacancyCode} · ${vacancy.branch.name}`, status: vacancy.status }
        // Another owner's job: title, site and seats only.
        : { entityType: 'vacancy' as const, entityId: vacancy.id, title: vacancy.position.title, subtitle: `${vacancy.branch.name} · ${vacancy.joinedHeadcount}/${vacancy.approvedHeadcount} seats`, redacted: true }),
    };
  }

  private async searchApplications(user: AuthUser, query: string, limit: number): Promise<GlobalSearchGroup> {
    const visibility = await this.accessControl.getApplicationVisibilityWhere(user);
    const applications = await this.prisma.application.findMany({
      where: {
        AND: [
          visibility,
          { organizationId: user.organizationId },
          {
            OR: [
              { applicationCode: { contains: query, mode: 'insensitive' } },
              { candidate: { firstName: { contains: query, mode: 'insensitive' } } },
              { candidate: { lastName: { contains: query, mode: 'insensitive' } } },
              { vacancy: { vacancyCode: { contains: query, mode: 'insensitive' } } },
              { vacancy: { position: { title: { contains: query, mode: 'insensitive' } } } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        applicationCode: true,
        stage: true,
        candidate: { select: { firstName: true, lastName: true } },
        vacancy: { select: { vacancyCode: true, position: { select: { title: true } } } },
      },
    });

    return {
      entityType: 'application',
      label: 'Applications',
      items: applications.map((application) => ({
        entityType: 'application',
        entityId: application.id,
        title: `${application.candidate.firstName} ${application.candidate.lastName}`,
        subtitle: `${application.vacancy.position.title} · ${application.applicationCode}`,
        status: application.stage,
      })),
    };
  }

  private async searchTasks(
    organizationId: string,
    userId: string,
    query: string,
    limit: number,
  ): Promise<GlobalSearchGroup> {
    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        assigneeUserId: userId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: limit,
      select: { id: true, title: true, priority: true, status: true, dueAt: true },
    });

    return {
      entityType: 'task',
      label: 'My tasks',
      items: tasks.map((task) => ({
        entityType: 'task',
        entityId: task.id,
        title: task.title,
        subtitle: task.dueAt ? `${task.priority} · Due ${task.dueAt.toISOString()}` : task.priority,
        status: task.status,
      })),
    };
  }
}
