import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { SavePositionLevelTargetsDto } from './position-level-targets.dto';

export const POSITION_LEVEL_CATEGORY = 'position-level-targets';
export const POSITION_LEVEL_AUDIT = 'POSITION_LEVEL_TARGETS_UPDATE';

export interface PositionLevelTargetView {
  id: string;
  levelCode: string;
  levelName: string;
  category: string;
  dailyCalls: number;
  dailyScreenings: number;
  monthlyInterviews: number;
  monthlyOffers: number;
  targetAcceptanceRate: number;
  slaScorecardHours: number;
}

export interface PositionLevelTargetDocument {
  persisted: boolean;
  levels: PositionLevelTargetView[];
}

/** Defaults match the previous on-screen matrix. They are activity quotas, not job seats. */
export const DEFAULT_POSITION_LEVELS: PositionLevelTargetView[] = [
  { id: 'L1-CONSULTANT', levelCode: 'L1-CONSULTANT', levelName: 'Senior Consultant & Medical Executive', category: 'Executive Clinical', dailyCalls: 8, dailyScreenings: 10, monthlyInterviews: 20, monthlyOffers: 2, targetAcceptanceRate: 90, slaScorecardHours: 12 },
  { id: 'L2-SPECIALIST', levelCode: 'L2-SPECIALIST', levelName: 'Specialist & Clinical Doctors', category: 'Clinical Medical', dailyCalls: 12, dailyScreenings: 15, monthlyInterviews: 35, monthlyOffers: 4, targetAcceptanceRate: 85, slaScorecardHours: 8 },
  { id: 'L3-NURSING', levelCode: 'L3-NURSING', levelName: 'Nursing & Allied Healthcare', category: 'Clinical Support', dailyCalls: 20, dailyScreenings: 30, monthlyInterviews: 50, monthlyOffers: 8, targetAcceptanceRate: 80, slaScorecardHours: 4 },
  { id: 'L4-TECH', levelCode: 'L4-TECH', levelName: 'Engineering & Technology', category: 'Digital & IT', dailyCalls: 15, dailyScreenings: 20, monthlyInterviews: 30, monthlyOffers: 3, targetAcceptanceRate: 85, slaScorecardHours: 6 },
  { id: 'L5-ADMIN', levelCode: 'L5-ADMIN', levelName: 'Operations & Hospital Administration', category: 'Administration', dailyCalls: 18, dailyScreenings: 25, monthlyInterviews: 40, monthlyOffers: 5, targetAcceptanceRate: 80, slaScorecardHours: 6 },
];

type QuotaKey = 'dailyCalls' | 'dailyScreenings' | 'monthlyInterviews' | 'monthlyOffers' | 'targetAcceptanceRate' | 'slaScorecardHours';

type StoredRow = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  metadata: Prisma.JsonValue | null;
};

function quota(metadata: Prisma.JsonValue | null, key: QuotaKey): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 0;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function businessCategory(metadata: Prisma.JsonValue | null): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const value = (metadata as Record<string, unknown>).category;
  return typeof value === 'string' ? value : '';
}

export function toLevelView(row: StoredRow): PositionLevelTargetView | null {
  const levelCode = row.code?.trim();
  if (!levelCode || row.status !== 'Active') return null;
  return {
    id: levelCode,
    levelCode,
    levelName: row.name,
    category: businessCategory(row.metadata),
    dailyCalls: quota(row.metadata, 'dailyCalls'),
    dailyScreenings: quota(row.metadata, 'dailyScreenings'),
    monthlyInterviews: quota(row.metadata, 'monthlyInterviews'),
    monthlyOffers: quota(row.metadata, 'monthlyOffers'),
    targetAcceptanceRate: quota(row.metadata, 'targetAcceptanceRate'),
    slaScorecardHours: quota(row.metadata, 'slaScorecardHours'),
  };
}

/** The stored document is activity quotas only. Seat counts and personal pay never belong here. */
export function levelAuditData(levels: PositionLevelTargetView[]): Prisma.InputJsonObject {
  return {
    persisted: true,
    levels: levels.map((level) => ({
      levelCode: level.levelCode,
      levelName: level.levelName,
      category: level.category,
      dailyCalls: level.dailyCalls,
      dailyScreenings: level.dailyScreenings,
      monthlyInterviews: level.monthlyInterviews,
      monthlyOffers: level.monthlyOffers,
      targetAcceptanceRate: level.targetAcceptanceRate,
      slaScorecardHours: level.slaScorecardHours,
    })),
  };
}

@Injectable()
export class PositionLevelTargetsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<PositionLevelTargetDocument> {
    const rows = await this.prisma.masterDataValue.findMany({
      where: { organizationId, category: POSITION_LEVEL_CATEGORY, status: 'Active' },
      orderBy: { code: 'asc' },
    });
    const levels = rows.map((row) => toLevelView(row)).filter((level): level is PositionLevelTargetView => level !== null);
    if (!levels.length) return { persisted: false, levels: DEFAULT_POSITION_LEVELS };
    return { persisted: true, levels };
  }

  async save(user: AuthUser, dto: SavePositionLevelTargetsDto): Promise<PositionLevelTargetDocument> {
    const codes = dto.levels.map((level) => level.levelCode.trim());
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException({ code: 'POSITION_LEVEL_DUPLICATE', message: 'Each position level code can be saved once.' });
    }
    const levels = await this.prisma.$transaction(async (tx) => {
      const saved: PositionLevelTargetView[] = [];
      for (const level of dto.levels) {
        const levelCode = level.levelCode.trim();
        const metadata = {
          category: level.category.trim(),
          dailyCalls: level.dailyCalls,
          dailyScreenings: level.dailyScreenings,
          monthlyInterviews: level.monthlyInterviews,
          monthlyOffers: level.monthlyOffers,
          targetAcceptanceRate: level.targetAcceptanceRate,
          slaScorecardHours: level.slaScorecardHours,
        } satisfies Prisma.InputJsonObject;
        const existing = await tx.masterDataValue.findFirst({
          where: { organizationId: user.organizationId, category: POSITION_LEVEL_CATEGORY, code: levelCode },
        });
        const row = existing
          ? await tx.masterDataValue.update({
            where: { id: existing.id },
            data: { name: level.levelName.trim(), metadata, status: 'Active' },
          })
          : await tx.masterDataValue.create({
            data: {
              organizationId: user.organizationId,
              category: POSITION_LEVEL_CATEGORY,
              code: levelCode,
              name: level.levelName.trim(),
              metadata,
              status: 'Active',
            },
          });
        const view = toLevelView(row);
        if (view) saved.push(view);
      }
      await tx.masterDataValue.updateMany({
        where: {
          organizationId: user.organizationId,
          category: POSITION_LEVEL_CATEGORY,
          code: { notIn: codes },
          status: 'Active',
        },
        data: { status: 'Inactive' },
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: POSITION_LEVEL_AUDIT,
          entityType: 'PositionLevelTarget',
          entityId: user.organizationId,
          result: 'SUCCESS',
          afterData: levelAuditData(saved),
        },
      });
      return saved;
    });
    return { persisted: true, levels };
  }
}
