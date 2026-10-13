import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { requirementProfileFromMetadata } from '../hiring/joining-policy';
import { buildWorkflowImpact, type WorkflowImpact, type WorkflowProfile } from './workflow-rule-impact';

export const WORKFLOW_RULE_AUDIT = 'WORKFLOW_RULE_APPLY';

@Injectable()
export class WorkflowRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const positions = await this.prisma.position.findMany({
      where: { organizationId, status: { not: 'Archived' } },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        metadata: true,
        vacancies: { select: { vacancyCode: true, status: true }, orderBy: { vacancyCode: 'asc' } },
      },
    });
    return {
      positions: positions.map((position) => ({
        id: position.id,
        code: position.code,
        title: position.title,
        profile: requirementProfileFromMetadata(position.metadata),
        vacancies: position.vacancies.map((vacancy) => ({ code: vacancy.vacancyCode, status: vacancy.status })),
      })),
    };
  }

  async preview(organizationId: string, positionId: string, profile: WorkflowProfile): Promise<WorkflowImpact> {
    return buildWorkflowImpact(await this.facts(organizationId, positionId, profile));
  }

  /**
   * Writes the position profile only when no protected job is on that position.
   * Vacancy status, seat counts, application stages, and stored snapshots are never updated.
   */
  async apply(user: AuthUser, positionId: string, profile: WorkflowProfile): Promise<WorkflowImpact> {
    const impact = await this.preview(user.organizationId, positionId, profile);
    if (!impact.applyAllowed) {
      throw new ConflictException({
        code: 'WORKFLOW_RULE_PREVIEW_ONLY',
        message: impact.message,
        impact,
      });
    }
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId: user.organizationId },
      select: { id: true, metadata: true },
    });
    if (!position) throw new NotFoundException('Position not found.');
    const metadata = position.metadata && typeof position.metadata === 'object' && !Array.isArray(position.metadata)
      ? { ...(position.metadata as Record<string, unknown>) }
      : {};
    metadata.requirementProfile = profile;
    await this.prisma.position.update({
      where: { id: position.id },
      data: { metadata: metadata as Prisma.InputJsonObject },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: WORKFLOW_RULE_AUDIT,
        entityType: 'Position',
        entityId: position.id,
        result: 'SUCCESS',
        afterData: { requirementProfile: profile, applyAllowed: true },
      },
    });
    return impact;
  }

  private async facts(organizationId: string, positionId: string, profile: WorkflowProfile) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId },
      select: { id: true, title: true, metadata: true },
    });
    if (!position) throw new NotFoundException('Position not found.');
    const vacancies = await this.prisma.vacancy.findMany({
      where: { organizationId, positionId },
      orderBy: { vacancyCode: 'asc' },
      select: {
        id: true,
        vacancyCode: true,
        status: true,
        approvedHeadcount: true,
        joinedHeadcount: true,
        applications: {
          select: {
            id: true,
            applicationCode: true,
            stage: true,
            hiringCase: { select: { requirementSnapshot: true } },
          },
        },
      },
    });
    return {
      positionId: position.id,
      positionTitle: position.title,
      currentProfile: requirementProfileFromMetadata(position.metadata),
      proposedProfile: profile,
      vacancies: vacancies.map((vacancy) => ({
        id: vacancy.id,
        code: vacancy.vacancyCode,
        status: vacancy.status,
        approvedHeadcount: vacancy.approvedHeadcount,
        joinedHeadcount: vacancy.joinedHeadcount,
      })),
      applications: vacancies.flatMap((vacancy) => vacancy.applications.map((application) => ({
        id: application.id,
        code: application.applicationCode,
        stage: application.stage,
        vacancyCode: vacancy.vacancyCode,
        hasSnapshot: application.hiringCase?.requirementSnapshot != null,
      }))),
    };
  }
}
