import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { UserPermissionsService } from '../common/user-permissions.service';

export interface GradeBandInput { gradeId?: string; branchId?: string; currency?: string; minMonthlyBase?: number; maxMonthlyBase?: number; status?: 'Active' | 'Inactive' }
export interface GradeBandView {
  id: string; grade: { id: string; name: string }; site: { id: string; name: string }; currency: string; status: string; version: number;
  /** Present only for OFFER_PAY_VIEW or MASTER_DATA_MANAGE holders (employees see the grade, never the pay). */
  minMonthlyBase?: number; maxMonthlyBase?: number;
}

/** B7 band rules: monthly BASE pay only (allowances never count), min <= max, no overlap per grade+site+currency, deactivate-only. */
@Injectable()
export class GradeBandsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserPermissionsService) private readonly permissions: UserPermissionsService,
  ) {}

  async canSeeBandPay(user: AuthUser): Promise<boolean> {
    const codes = await this.permissions.getPermissionSet(user.userId, user.organizationId);
    return codes.has('OFFER_PAY_VIEW') || codes.has('MASTER_DATA_MANAGE');
  }

  private view(b: { id: string; currency: string; status: string; version: number; minMonthlyBase: Prisma.Decimal; maxMonthlyBase: Prisma.Decimal; grade: { id: string; name: string }; branch: { id: string; name: string } }, pay: boolean): GradeBandView {
    return {
      id: b.id, grade: b.grade, site: b.branch, currency: b.currency, status: b.status, version: b.version,
      ...(pay ? { minMonthlyBase: Number(b.minMonthlyBase), maxMonthlyBase: Number(b.maxMonthlyBase) } : {}),
    };
  }
  private readonly include = { grade: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } } as const;

  async list(user: AuthUser, includeInactive = false): Promise<GradeBandView[]> {
    const pay = await this.canSeeBandPay(user);
    const rows = await this.prisma.gradeBand.findMany({
      where: { organizationId: user.organizationId, ...(includeInactive ? {} : { status: 'Active' }) },
      include: this.include,
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map((r) => this.view(r, pay));
  }

  private assertAmounts(min: number, max: number) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0) throw new BadRequestException({ code: 'GRADE_BAND_AMOUNT_INVALID', message: 'Band amounts must be non-negative numbers.' });
    if (min > max) throw new BadRequestException({ code: 'GRADE_BAND_MIN_GT_MAX', message: 'Band minimum must be less than or equal to the maximum.' });
  }

  private async assertNoOverlap(tx: Prisma.TransactionClient, org: string, b: { id?: string; gradeId: string; branchId: string; currency: string; min: number; max: number }) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`grade-band:${org}:${b.gradeId}:${b.branchId}:${b.currency}`}))`;
    const clash = await tx.gradeBand.findFirst({
      where: {
        organizationId: org, gradeId: b.gradeId, branchId: b.branchId, currency: b.currency, status: 'Active',
        ...(b.id ? { id: { not: b.id } } : {}),
        minMonthlyBase: { lte: b.max }, maxMonthlyBase: { gte: b.min },
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException({ code: 'GRADE_BAND_OVERLAP', message: 'An active band for this grade, site and currency overlaps this range.', conflictingBandId: clash.id });
  }

  private async assertRefs(org: string, gradeId: string, branchId: string) {
    const [grade, branch] = await Promise.all([
      this.prisma.masterDataValue.findFirst({ where: { id: gradeId, organizationId: org, category: 'grades', status: 'Active' }, select: { id: true } }),
      this.prisma.branch.findFirst({ where: { id: branchId, organizationId: org }, select: { id: true } }),
    ]);
    if (!grade) throw new BadRequestException({ code: 'GRADE_INVALID', message: 'Grade must be an active master-data grade.' });
    if (!branch) throw new BadRequestException({ code: 'SITE_INVALID', message: 'Site (branch) not found.' });
  }

  async create(user: AuthUser, input: GradeBandInput): Promise<GradeBandView> {
    if (!input.gradeId || !input.branchId || !input.currency || input.minMonthlyBase === undefined || input.maxMonthlyBase === undefined) {
      throw new BadRequestException({ code: 'GRADE_BAND_FIELDS_REQUIRED', message: 'gradeId, branchId, currency, minMonthlyBase and maxMonthlyBase are required.' });
    }
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException({ code: 'CURRENCY_INVALID', message: 'Currency must be a 3-letter code.' });
    this.assertAmounts(input.minMonthlyBase, input.maxMonthlyBase);
    await this.assertRefs(user.organizationId, input.gradeId, input.branchId);
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, user.organizationId, { gradeId: input.gradeId!, branchId: input.branchId!, currency, min: input.minMonthlyBase!, max: input.maxMonthlyBase! });
      return tx.gradeBand.create({
        data: { organizationId: user.organizationId, gradeId: input.gradeId!, branchId: input.branchId!, currency, minMonthlyBase: input.minMonthlyBase!, maxMonthlyBase: input.maxMonthlyBase!, createdById: user.userId },
        include: this.include,
      });
    });
    return this.view(created, true);
  }

  /** Amounts and status only (grade/site/currency are the band's identity; make a new band instead). */
  async update(user: AuthUser, id: string, input: GradeBandInput): Promise<GradeBandView> {
    const band = await this.prisma.gradeBand.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!band) throw new NotFoundException('Grade band not found.');
    if ((input.gradeId && input.gradeId !== band.gradeId) || (input.branchId && input.branchId !== band.branchId) || (input.currency && input.currency.toUpperCase() !== band.currency)) {
      throw new BadRequestException({ code: 'GRADE_BAND_IDENTITY_IMMUTABLE', message: 'Grade, site and currency cannot change; deactivate this band and create a new one.' });
    }
    const min = input.minMonthlyBase ?? Number(band.minMonthlyBase);
    const max = input.maxMonthlyBase ?? Number(band.maxMonthlyBase);
    const status = input.status ?? band.status;
    this.assertAmounts(min, max);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (status === 'Active') await this.assertNoOverlap(tx, user.organizationId, { id, gradeId: band.gradeId, branchId: band.branchId, currency: band.currency, min, max });
      return tx.gradeBand.update({ where: { id }, data: { minMonthlyBase: min, maxMonthlyBase: max, status, version: { increment: 1 } }, include: this.include });
    });
    return this.view(updated, true);
  }

  /** No delete: DELETE deactivates. */
  async deactivate(user: AuthUser, id: string): Promise<GradeBandView> {
    const band = await this.prisma.gradeBand.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } });
    if (!band) throw new NotFoundException('Grade band not found.');
    const updated = await this.prisma.gradeBand.update({ where: { id }, data: { status: 'Inactive', version: { increment: 1 } }, include: this.include });
    return this.view(updated, true);
  }
}
