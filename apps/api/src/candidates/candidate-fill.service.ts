import { readFile } from 'node:fs/promises';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { DocumentsService } from '../documents/documents.service';
import { ResumeParsingService } from '../resume/resume-parsing.service';
import { planFillFromCv, type FillConflict } from './fill-from-cv';

@Injectable()
export class CandidateFillService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(ResumeParsingService) private readonly parser: ResumeParsingService,
  ) {}

  /** POST /candidates/:id/fill-from-cv — parse the candidate's latest CV and fill only empty fields. */
  async fillFromCv(user: AuthUser, candidateId: string): Promise<{ candidateId: string; documentId: string; filled: string[]; conflicts: FillConflict[] }> {
    const scope = await this.access.getCandidateVisibilityWhere(user);
    const candidate = await this.prisma.candidate.findFirst({ where: { AND: [scope, { id: candidateId, organizationId: user.organizationId }] } });
    if (!candidate) throw new NotFoundException('Candidate not found.');
    const cv = await this.prisma.candidateDocument.findFirst({
      where: { organizationId: user.organizationId, candidateId, documentType: { in: ['CV', 'Resume'] }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!cv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'This candidate has no CV on file.' });
    const file = await this.documents.getFile(user.organizationId, cv.id, user); // scan, consent, retention, access
    const parsed = await this.parser.parseResume({ buffer: await readFile(file.path), originalname: file.fileName, mimetype: file.mimeType });
    const plan = planFillFromCv(candidate as unknown as Record<string, unknown> & { skills: string[] }, parsed);
    if (Object.keys(plan.data).length) await this.prisma.candidate.update({ where: { id: candidateId }, data: plan.data });
    return { candidateId, documentId: cv.id, filled: plan.filled, conflicts: plan.conflicts };
  }
}
