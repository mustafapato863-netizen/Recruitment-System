import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
import { PrismaService } from '../database/prisma.service';
import { UserPermissionsService } from '../common/user-permissions.service';
import { catalogKey } from '../master-data/catalog-normalization';
import { normalizeEmailKey, normalizePhoneKey } from '../candidates/contact-keys';
import { EVIDENCE_SOURCE_TYPES, findSkillSnippet, type EvidenceSourceType } from './skill-evidence';

export interface EvidenceItem {
  id: string;
  sourceType: string;
  sourceRef: string | null;
  snippet: string | null;
  addedBy: { id: string; name: string } | null;
  addedAt: string;
}
export interface SkillRef { id: string | null; name: string }
export interface MatchedSkill { skill: SkillRef; hasEvidence: boolean; evidence: EvidenceItem[] }
export interface Suggestion {
  candidate: { id: string; code: string; name: string; currentTitle: string | null; location: string | null };
  matchedSkills: MatchedSkill[];
  missingSkills: SkillRef[];
}
export interface SuggestionsResponse {
  vacancyId: string;
  requiredSkills: SkillRef[];
  /** Required skills on the job that are not in the skill library (cannot be evidenced). */
  unmappedRequiredSkills: string[];
  orderedBy: string[];
  suggestions: Suggestion[];
}
export type CompareCell = { candidateId: string; status: 'evidence' | 'no-evidence' | 'missing'; evidence: EvidenceItem[] };
export interface CompareResponse {
  vacancyId: string;
  candidates: Suggestion['candidate'][];
  rows: Array<{ skill: SkillRef; cells: CompareCell[] }>;
}

/** Documented ordering (no score is computed or returned). */
export const SUGGESTION_ORDER = [
  'required skills with at least one piece of evidence (more first)',
  'required skills held, with or without evidence (more first)',
  'most recent evidence (newer first)',
  'candidate last updated (newer first)',
  'candidate code (A-Z)',
];

const ACTIVE_CANDIDATE = 'Active';
const SUGGESTION_LIMIT = 50;

type CandidateWithSkills = {
  id: string; candidateCode: string; firstName: string; lastName: string; currentTitle: string | null; location: string | null; updatedAt: Date;
  skillLinks: Array<{ skillId: string; evidence: Array<{ id: string; sourceType: string; sourceRef: string | null; snippet: string | null; createdAt: Date; addedBy: { id: string; displayName: string } | null }> }>;
};

@Injectable()
export class MatchingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserPermissionsService) private readonly permissions: UserPermissionsService,
  ) {}

  /**
   * Interim access rule (B1 not on this base): the job's owner (active PRIMARY
   * assignment), that owner's manager, ADMINISTRATOR, or VACANCY_MANAGE.
   * TODO(B1): use Vacancy.primaryRecruiterId + file-access.ts once #4 merges.
   */
  async assertJobAccess(user: AuthUser, vacancyId: string) {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, organizationId: user.organizationId },
      select: { id: true, requiredSkills: true, assignments: { where: { isActive: true, assignmentKind: 'PRIMARY' }, select: { userId: true, user: { select: { managerId: true } } } } },
    });
    if (!vacancy) throw new NotFoundException('Job not found.');
    if (user.roleCodes.includes('ADMINISTRATOR')) return vacancy;
    if (vacancy.assignments.some((a) => a.userId === user.userId || a.user.managerId === user.userId)) return vacancy;
    if (await this.permissions.hasPermission(user.userId, user.organizationId, 'VACANCY_MANAGE')) return vacancy;
    throw new ForbiddenException({ code: 'NOT_JOB_OWNER', message: 'Only the job owner, their manager or a full-access user can suggest or compare for this job.' });
  }

  private async resolveRequired(organizationId: string, requiredSkills: string[]) {
    const library = await this.prisma.masterDataValue.findMany({
      where: { organizationId, category: 'skills' },
      select: { id: true, name: true, status: true },
      orderBy: [{ createdAt: 'asc' }],
    });
    const byKey = new Map<string, { id: string; name: string }>();
    for (const v of [...library.filter((x) => x.status === 'Active'), ...library.filter((x) => x.status !== 'Active')]) {
      if (!byKey.has(catalogKey(v.name))) byKey.set(catalogKey(v.name), v);
    }
    const required: Array<{ id: string; name: string }> = [];
    const unmapped: string[] = [];
    const seen = new Set<string>();
    for (const raw of requiredSkills) {
      const key = catalogKey(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const hit = byKey.get(key);
      if (hit) required.push({ id: hit.id, name: hit.name }); else unmapped.push(raw.trim());
    }
    return { required, unmapped };
  }

  private candidateSelect(skillIds: string[]) {
    return {
      id: true, candidateCode: true, firstName: true, lastName: true, currentTitle: true, location: true, updatedAt: true,
      skillLinks: {
        where: { skillId: { in: skillIds } },
        select: {
          skillId: true,
          evidence: {
            orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
            select: { id: true, sourceType: true, sourceRef: true, snippet: true, createdAt: true, addedBy: { select: { id: true, displayName: true } } },
          },
        },
      },
    } satisfies Prisma.CandidateSelect;
  }

  private shape(c: CandidateWithSkills, required: Array<{ id: string; name: string }>): Suggestion & { _evidenced: number; _held: number; _latest: number } {
    const links = new Map(c.skillLinks.map((l) => [l.skillId, l]));
    const matchedSkills: MatchedSkill[] = [];
    const missingSkills: SkillRef[] = [];
    let latest = 0;
    for (const skill of required) {
      const link = links.get(skill.id);
      if (!link) { missingSkills.push(skill); continue; }
      const evidence = link.evidence.map((e) => {
        latest = Math.max(latest, e.createdAt.getTime());
        return { id: e.id, sourceType: e.sourceType, sourceRef: e.sourceRef, snippet: e.snippet, addedBy: e.addedBy ? { id: e.addedBy.id, name: e.addedBy.displayName } : null, addedAt: e.createdAt.toISOString() };
      });
      matchedSkills.push({ skill, hasEvidence: evidence.length > 0, evidence });
    }
    return {
      candidate: { id: c.id, code: c.candidateCode, name: `${c.firstName} ${c.lastName}`.trim(), currentTitle: c.currentTitle, location: c.location },
      matchedSkills, missingSkills,
      _evidenced: matchedSkills.filter((m) => m.hasEvidence).length, _held: matchedSkills.length, _latest: latest,
    };
  }

  async suggestions(user: AuthUser, vacancyId: string): Promise<SuggestionsResponse> {
    const vacancy = await this.assertJobAccess(user, vacancyId);
    const { required, unmapped } = await this.resolveRequired(user.organizationId, vacancy.requiredSkills);
    const base = { vacancyId, requiredSkills: required, unmappedRequiredSkills: unmapped, orderedBy: SUGGESTION_ORDER };
    if (required.length === 0) return { ...base, suggestions: [] };
    const skillIds = required.map((r) => r.id);
    const candidates = await this.prisma.candidate.findMany({
      where: {
        organizationId: user.organizationId,
        // Excludes Archived / Blacklisted. TODO(B2): also exclude anonymizedAt IS NOT NULL once #6 merges.
        status: ACTIVE_CANDIDATE,
        applications: { none: { vacancyId } },
        skillLinks: { some: { skillId: { in: skillIds } } },
      },
      select: this.candidateSelect(skillIds),
      take: 1000,
    });
    const shaped = candidates.map((c) => ({ ...this.shape(c, required), updatedAt: c.updatedAt.getTime() }));
    shaped.sort((a, b) =>
      b._evidenced - a._evidenced || b._held - a._held || b._latest - a._latest || b.updatedAt - a.updatedAt || a.candidate.code.localeCompare(b.candidate.code));
    return { ...base, suggestions: shaped.slice(0, SUGGESTION_LIMIT).map(({ candidate, matchedSkills, missingSkills }) => ({ candidate, matchedSkills, missingSkills })) };
  }

  async compare(user: AuthUser, vacancyId: string, candidateIds: string[]): Promise<CompareResponse> {
    const ids = [...new Set(candidateIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length < 2 || ids.length > 4) throw new BadRequestException({ code: 'COMPARE_COUNT', message: 'Compare 2 to 4 candidates.' });
    const vacancy = await this.assertJobAccess(user, vacancyId);
    const { required } = await this.resolveRequired(user.organizationId, vacancy.requiredSkills);
    const found = await this.prisma.candidate.findMany({
      where: { id: { in: ids }, organizationId: user.organizationId, status: ACTIVE_CANDIDATE },
      select: this.candidateSelect(required.map((r) => r.id)),
    });
    if (found.length !== ids.length) throw new NotFoundException({ code: 'COMPARE_CANDIDATE_NOT_FOUND', message: 'One or more candidates were not found or are not active.' });
    const shaped = ids.map((id) => this.shape(found.find((c) => c.id === id)!, required));
    return {
      vacancyId,
      candidates: shaped.map((s) => s.candidate),
      rows: required.map((skill) => ({
        skill,
        cells: shaped.map((s) => {
          const m = s.matchedSkills.find((x) => x.skill.id === skill.id);
          return { candidateId: s.candidate.id, status: !m ? 'missing' : m.hasEvidence ? 'evidence' : 'no-evidence', evidence: m?.evidence ?? [] } as CompareCell;
        }),
      })),
    };
  }

  // ─── Candidate skills and evidence ────────────────────────────

  private async candidateOrThrow(organizationId: string, candidateId: string) {
    const c = await this.prisma.candidate.findFirst({ where: { id: candidateId, organizationId }, select: { id: true, organizationId: true } });
    if (!c) throw new NotFoundException('Candidate not found.');
    return c;
  }

  async listCandidateSkills(organizationId: string, candidateId: string) {
    await this.candidateOrThrow(organizationId, candidateId);
    const links = await this.prisma.candidateSkill.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'asc' },
      select: { skill: { select: { id: true, name: true, status: true, metadata: true } }, evidence: { orderBy: { createdAt: 'desc' }, select: { id: true, sourceType: true, sourceRef: true, snippet: true, createdAt: true, addedBy: { select: { id: true, displayName: true } } } } },
    });
    return links.map((l) => ({
      skill: { id: l.skill.id, name: l.skill.name, active: l.skill.status === 'Active', category: (l.skill.metadata as { category?: string } | null)?.category ?? null },
      hasEvidence: l.evidence.length > 0,
      evidence: l.evidence.map((e) => ({ id: e.id, sourceType: e.sourceType, sourceRef: e.sourceRef, snippet: e.snippet, addedBy: e.addedBy ? { id: e.addedBy.id, name: e.addedBy.displayName } : null, addedAt: e.createdAt.toISOString() })),
    }));
  }

  /** Links a library skill to the candidate and records one piece of evidence (idempotent per source). */
  async addEvidence(
    organizationId: string,
    candidateId: string,
    input: { skillId: string; sourceType?: EvidenceSourceType; sourceRef?: string | null; snippet?: string | null },
    addedById: string | null,
  ) {
    await this.candidateOrThrow(organizationId, candidateId);
    const sourceType = input.sourceType ?? 'MANUAL';
    if (!EVIDENCE_SOURCE_TYPES.includes(sourceType)) throw new BadRequestException({ code: 'EVIDENCE_SOURCE_INVALID', message: `sourceType must be one of ${EVIDENCE_SOURCE_TYPES.join(', ')}.` });
    if (sourceType === 'MANUAL' && !input.snippet?.trim()) throw new BadRequestException({ code: 'EVIDENCE_SNIPPET_REQUIRED', message: 'Manual evidence needs a snippet or quote.' });
    const skill = await this.prisma.masterDataValue.findFirst({ where: { id: input.skillId, organizationId, category: 'skills' }, select: { id: true, status: true } });
    if (!skill) throw new BadRequestException({ code: 'SKILL_NOT_IN_LIBRARY', message: 'The skill is not in the skill library.' });
    if (skill.status !== 'Active') throw new BadRequestException({ code: 'SKILL_INACTIVE', message: 'The skill is deactivated in the library.' });
    return this.prisma.$transaction((tx) => this.recordEvidence(tx, organizationId, candidateId, skill.id, sourceType, input.sourceRef ?? null, input.snippet?.trim().slice(0, 1000) ?? null, addedById));
  }

  async recordEvidence(
    tx: Pick<PrismaService, 'candidateSkill' | 'candidateSkillEvidence'>,
    organizationId: string, candidateId: string, skillId: string,
    sourceType: EvidenceSourceType, sourceRef: string | null, snippet: string | null, addedById: string | null,
  ) {
    const link = await tx.candidateSkill.upsert({
      where: { candidateId_skillId: { candidateId, skillId } },
      create: { organizationId, candidateId, skillId },
      update: {},
    });
    // NULL sourceRef never conflicts in a unique index, so dedupe manual-without-ref by snippet.
    const existing = await tx.candidateSkillEvidence.findFirst({ where: { candidateSkillId: link.id, sourceType, sourceRef, ...(sourceRef ? {} : { snippet }) } });
    if (existing) return existing;
    return tx.candidateSkillEvidence.create({ data: { candidateSkillId: link.id, sourceType, sourceRef, snippet, addedById } });
  }

  /**
   * Scans the candidate's CV text, screening notes and scorecards for ACTIVE
   * library skills and records evidence (idempotent). Returns what was found.
   */
  async deriveEvidence(organizationId: string, candidateId: string, actorUserId: string | null) {
    await this.candidateOrThrow(organizationId, candidateId);
    const [skills, docs, screens, cards] = await Promise.all([
      this.prisma.masterDataValue.findMany({ where: { organizationId, category: 'skills', status: 'Active' }, select: { id: true, name: true } }),
      this.prisma.candidateDocument.findMany({ where: { organizationId, candidateId, deletedAt: null, extractionText: { not: null } }, select: { id: true, extractionText: true } }),
      this.prisma.screeningLog.findMany({ where: { organizationId, application: { candidateId } }, select: { id: true, notes: true } }),
      this.prisma.interviewScorecard.findMany({ where: { interview: { organizationId, application: { candidateId } } }, select: { id: true, notes: true, strengths: true } }),
    ]);
    const sources: Array<{ type: EvidenceSourceType; ref: string; text: string | null }> = [
      ...docs.map((d) => ({ type: 'CV_TEXT' as const, ref: d.id, text: d.extractionText })),
      ...screens.map((s) => ({ type: 'SCREENING_NOTE' as const, ref: s.id, text: s.notes })),
      ...cards.map((c) => ({ type: 'SCORECARD' as const, ref: c.id, text: [c.strengths, c.notes].filter(Boolean).join('\n') })),
    ];
    const found: Array<{ skillId: string; skill: string; sourceType: EvidenceSourceType; sourceRef: string }> = [];
    await this.prisma.$transaction(async (tx) => {
      for (const src of sources) {
        for (const skill of skills) {
          const snippet = findSkillSnippet(src.text, skill.name);
          if (!snippet) continue;
          await this.recordEvidence(tx, organizationId, candidateId, skill.id, src.type, src.ref, snippet, actorUserId);
          found.push({ skillId: skill.id, skill: skill.name, sourceType: src.type, sourceRef: src.ref });
        }
      }
    });
    return { candidateId, found };
  }

  // ─── Duplicate check ──────────────────────────────────────────

  async duplicateCheck(organizationId: string, input: { email?: string | null; phone?: string | null }) {
    const email = normalizeEmailKey(input.email);
    const phone = normalizePhoneKey(input.phone);
    if (!email && !phone) throw new BadRequestException({ code: 'CONTACT_REQUIRED', message: 'Provide an email or a phone.' });
    const rows = await this.prisma.candidate.findMany({
      where: { organizationId, OR: [...(email ? [{ emailNormalized: email }] : []), ...(phone ? [{ phoneNormalized: phone }] : [])] },
      select: { id: true, candidateCode: true, firstName: true, lastName: true, status: true, emailNormalized: true, phoneNormalized: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    return {
      normalized: { email, phone },
      isDuplicate: rows.length > 0,
      matches: rows.map((r) => ({
        candidateId: r.id, candidateCode: r.candidateCode, name: `${r.firstName} ${r.lastName}`.trim(), status: r.status,
        matchedBy: [...(email && r.emailNormalized === email ? ['email'] : []), ...(phone && r.phoneNormalized === phone ? ['phone'] : [])],
      })),
    };
  }
}
