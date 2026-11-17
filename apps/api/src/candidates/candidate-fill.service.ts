import { readFile } from 'node:fs/promises';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser, ExtractedCandidate } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { DocumentsService } from '../documents/documents.service';
import { ResumeParsingService } from '../resume/resume-parsing.service';
import { planFillFromCv, type FillConflict } from './fill-from-cv';
import { linkCandidateSkills } from '../matching/skill-links';

export interface FillFromCvInput {
  documentId?: string;
  parsed?: ExtractedCandidate | Record<string, unknown>;
}

@Injectable()
export class CandidateFillService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(ResumeParsingService) private readonly parser: ResumeParsingService,
  ) {}

  /** POST /candidates/:id/fill-from-cv — parse the candidate's latest CV and fill only empty fields. */
  async fillFromCv(
    user: AuthUser,
    candidateId: string,
    input: FillFromCvInput = {},
  ): Promise<{ candidateId: string; documentId: string; filled: string[]; conflicts: FillConflict[]; compared: boolean }> {
    const scope = await this.access.getCandidateVisibilityWhere(user);
    const candidate = await this.prisma.candidate.findFirst({ where: { AND: [scope, { id: candidateId, organizationId: user.organizationId }] } });
    if (!candidate) throw new NotFoundException('Candidate not found.');
    const cv = await this.prisma.candidateDocument.findFirst({
      where: {
        organizationId: user.organizationId,
        candidateId,
        ...(input.documentId ? { id: input.documentId } : { documentType: { in: ['CV', 'Resume'] } }),
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!cv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'This candidate has no CV on file.' });
    const hasProvidedParsed = Boolean(
      input.parsed
      && typeof input.parsed === 'object'
      && Object.keys(input.parsed).some((k) => (input.parsed as Record<string, unknown>)[k] !== undefined),
    );
    const parsed: ExtractedCandidate = hasProvidedParsed
      ? (input.parsed as ExtractedCandidate)
      : await (async () => {
          const file = await this.documents.getFile(user.organizationId, cv.id, user);
          return this.parser.parseResume({ buffer: await readFile(file.path), originalname: file.fileName, mimetype: file.mimeType });
        })();
    const applyFill = async (tx: PrismaService) => {
      const fresh = (await tx.candidate.findFirst({
        where: { id: candidateId, organizationId: user.organizationId },
      })) ?? candidate;
      const plan = planFillFromCv(fresh as unknown as Record<string, unknown> & { skills: string[] }, parsed);
      if (Object.keys(plan.data).length) {
        await tx.candidate.update({ where: { id: candidateId }, data: plan.data });
      }
      if (Array.isArray(plan.data.skills) && plan.data.skills.length > 0) {
        const hasSkillDelegates = Boolean(
          (tx as { masterDataValue?: { findMany?: unknown }; candidateSkill?: { createMany?: unknown } }).masterDataValue?.findMany
          && (tx as { candidateSkill?: { createMany?: unknown } }).candidateSkill?.createMany,
        );
        if (hasSkillDelegates) {
          await linkCandidateSkills(tx as never, user.organizationId, candidateId, plan.data.skills as string[]);
        }
      }
      return plan;
    };
    const plan = typeof this.prisma.$transaction === 'function'
      ? await this.prisma.$transaction((tx) => applyFill(tx as unknown as PrismaService))
      : await applyFill(this.prisma);
    return { candidateId, documentId: cv.id, filled: plan.filled, conflicts: plan.conflicts, compared: true };
  }
}
