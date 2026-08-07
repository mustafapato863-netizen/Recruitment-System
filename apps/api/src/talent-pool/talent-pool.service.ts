import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateTalentPoolDto, AddToPoolDto } from './talent-pool.dto';
import type { TalentPoolItem, TalentPoolCandidateItem, TalentPoolHealthMetrics } from '@recruitflow/contracts';

@Injectable()
export class TalentPoolService {
  constructor(private readonly prisma: PrismaService) {}

  async getPools(organizationId: string): Promise<TalentPoolItem[]> {
    const pools = await this.prisma.talentPool.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      description: pool.description,
      tags: pool.tags,
      status: pool.status,
      candidateCount: pool._count.candidates,
      updatedAt: pool.updatedAt.toISOString(),
    }));
  }

  async createPool(organizationId: string, dto: CreateTalentPoolDto): Promise<TalentPoolItem> {
    const pool = await this.prisma.talentPool.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description ?? null,
        tags: dto.tags || [],
      },
    });

    return {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      tags: pool.tags,
      status: pool.status,
      candidateCount: 0,
      updatedAt: pool.updatedAt.toISOString(),
    };
  }

  async getRecentlyAdded(organizationId: string): Promise<TalentPoolCandidateItem[]> {
    const recent = await this.prisma.talentPoolCandidate.findMany({
      where: {
        talentPool: { organizationId },
      },
      include: {
        candidate: true,
        talentPool: true,
      },
      orderBy: { addedAt: 'desc' },
      take: 20,
    });

    return recent.map((item) => ({
      id: item.id,
      candidateId: item.candidateId,
      candidateName: `${item.candidate.firstName} ${item.candidate.lastName}`.trim(),
      poolName: item.talentPool.name,
      eligibility: item.eligibility,
      coolingOffUntil: item.coolingOffUntil?.toISOString() ?? null,
      consentStatus: item.consentStatus,
      consentExpiry: item.consentExpiry?.toISOString() ?? null,
      source: item.source,
      addedAt: item.addedAt.toISOString(),
    }));
  }

  async getHealthMetrics(organizationId: string): Promise<TalentPoolHealthMetrics> {
    const totalCandidates = await this.prisma.talentPoolCandidate.count({
      where: { talentPool: { organizationId } },
    });

    if (totalCandidates === 0) {
      return {
        activeConsentPercent: 0,
        profileFreshPercent: 0,
        recentContactPercent: 0,
      };
    }

    const [activeConsent, profileFresh, recentContact] = await Promise.all([
      this.prisma.talentPoolCandidate.count({
        where: {
          talentPool: { organizationId },
          consentStatus: 'Active',
        },
      }),
      this.prisma.talentPoolCandidate.count({
        where: {
          talentPool: { organizationId },
          candidate: {
            updatedAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // ~12m
            },
          },
        },
      }),
      this.prisma.talentPoolCandidate.count({
        where: {
          talentPool: { organizationId },
          candidate: {
            updatedAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // ~90d approx for recent contact since we don't have explicit contact tracking
            },
          },
        },
      }),
    ]);

    return {
      activeConsentPercent: Math.round((activeConsent / totalCandidates) * 100),
      profileFreshPercent: Math.round((profileFresh / totalCandidates) * 100),
      recentContactPercent: Math.round((recentContact / totalCandidates) * 100),
    };
  }

  async getPoolDetail(organizationId: string, id: string, page = 1, pageSize = 20) {
    const pool = await this.prisma.talentPool.findFirst({
      where: { id, organizationId },
    });

    if (!pool) {
      throw new NotFoundException('Talent pool not found');
    }

    const skip = (page - 1) * pageSize;
    const [total, candidates] = await Promise.all([
      this.prisma.talentPoolCandidate.count({
        where: { talentPoolId: id },
      }),
      this.prisma.talentPoolCandidate.findMany({
        where: { talentPoolId: id },
        include: { candidate: true },
        orderBy: { addedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        description: pool.description,
        tags: pool.tags,
        status: pool.status,
        updatedAt: pool.updatedAt.toISOString(),
      },
      candidates: candidates.map((c) => ({
        id: c.id,
        candidateId: c.candidateId,
        candidateName: `${c.candidate.firstName} ${c.candidate.lastName}`.trim(),
        poolName: pool.name,
        eligibility: c.eligibility,
        coolingOffUntil: c.coolingOffUntil?.toISOString() ?? null,
        consentStatus: c.consentStatus,
        consentExpiry: c.consentExpiry?.toISOString() ?? null,
        source: c.source,
        addedAt: c.addedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async addCandidate(organizationId: string, id: string, dto: AddToPoolDto) {
    const pool = await this.prisma.talentPool.findFirst({
      where: { id, organizationId },
    });

    if (!pool) {
      throw new NotFoundException('Talent pool not found');
    }

    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, organizationId },
      select: { id: true },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found in this organization');
    }

    const existing = await this.prisma.talentPoolCandidate.findUnique({
      where: { talentPoolId_candidateId: { talentPoolId: id, candidateId: dto.candidateId } },
    });
    if (existing) {
      throw new ConflictException('Candidate is already in this talent pool');
    }

    const tpc = await this.prisma.talentPoolCandidate.create({
      data: {
        talentPoolId: id,
        candidateId: dto.candidateId,
        source: dto.source ?? null,
        consentExpiry: dto.consentExpiry ? new Date(dto.consentExpiry) : null,
      },
    });

    return tpc;
  }

  async removeCandidate(organizationId: string, poolId: string, candidateId: string) {
    const pool = await this.prisma.talentPool.findFirst({
      where: { id: poolId, organizationId },
    });

    if (!pool) {
      throw new NotFoundException('Talent pool not found');
    }

    const tpc = await this.prisma.talentPoolCandidate.findFirst({
      where: { talentPoolId: poolId, candidateId },
    });

    if (!tpc) {
      throw new NotFoundException('Candidate not found in pool');
    }

    await this.prisma.talentPoolCandidate.delete({
      where: { id: tpc.id },
    });

    return { success: true };
  }
}
