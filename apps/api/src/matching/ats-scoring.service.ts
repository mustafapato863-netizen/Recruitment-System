import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AtsEvaluationResult,
  AtsMatchBreakdown,
  AtsSkillMatchItem,
  AuthUser,
  CandidateJobRecommendation,
  JdCriteriaDefinition,
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { UserPermissionsService } from '../common/user-permissions.service';
import { findSkillSnippet } from './skill-evidence';
import { isSkillLinkActive } from './skill-links';

const ATS_VERSION = 'v2-ats-1.1';

@Injectable()
export class AtsScoringService {
  private readonly logger = new Logger(AtsScoringService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserPermissionsService) private readonly permissions: UserPermissionsService,
  ) {}

  /**
   * Anti-bias and pay-safety sanitizer.
   * Strips protected demographic attributes and compensation before ATS scoring.
   */
  sanitizeForAtsScoring<T extends {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    currentCompany?: string | null;
    salary?: unknown;
    compensation?: unknown;
  }>(candidate: T): Omit<T, 'firstName' | 'lastName' | 'email' | 'phone' | 'salary' | 'compensation'> {
    const { firstName, lastName, email, phone, salary, compensation, ...safe } = candidate;
    return safe;
  }

  /**
   * Evaluate ATS job-fit score and breakdown for an application.
   */
  async evaluateApplicationAts(
    organizationId: string,
    applicationId: string,
    user?: AuthUser,
  ): Promise<AtsEvaluationResult> {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, organizationId },
      include: {
        candidate: {
          include: {
            skillLinks: {
              include: {
                skill: { select: { id: true, name: true } },
                evidence: {
                  orderBy: { createdAt: 'desc' },
                  take: 3,
                  select: { id: true, snippet: true, sourceType: true },
                },
              },
            },
            documents: {
              where: { deletedAt: null, extractionText: { not: null } },
              select: { id: true, extractionText: true, fileName: true },
            },
          },
        },
        vacancy: {
          select: {
            id: true,
            vacancyCode: true,
            requiredSkills: true,
            minExperienceYears: true,
            jdCriteria: true,
          },
        },
      },
    });

    if (!app) throw new NotFoundException('Application not found.');

    const candidate = app.candidate;
    const vacancy = app.vacancy;

    // Resolve Criteria (from locked/draft jdCriteria or fallback to requiredSkills)
    const criteria: JdCriteriaDefinition =
      (vacancy.jdCriteria as unknown as JdCriteriaDefinition) || {
        version: 1,
        isLocked: false,
        minExperienceYears: vacancy.minExperienceYears ?? null,
        educationLevels: [],
        languages: [],
        workMode: 'On-site',
        mustHaveSkills: vacancy.requiredSkills.map((s, i) => ({ id: `must-${i}`, name: s })),
        niceToHaveSkills: [],
        knockoutRules: [
          ...(vacancy.minExperienceYears
            ? [{ id: 'ko-exp', field: 'experienceYears' as const, operator: 'GTE' as const, value: vacancy.minExperienceYears, failureMessage: `Requires at least ${vacancy.minExperienceYears} years experience.` }]
            : []),
        ],
        weights: { skills: 50, experience: 30, education: 10, languages: 10 },
      };

    const candidateExpYears = candidate.experienceYears ?? null;
    const candidateLinkSkills = new Map(
      candidate.skillLinks.map((l) => [l.skill.name.toLowerCase(), l]),
    );

    // Collect all candidate text sources for snippet verification
    const combinedCvText = candidate.documents.map((d) => d.extractionText || '').join('\n\n');

    // 1. Evaluate Knockout Rules
    const knockoutFailures: string[] = [];
    const manualReviewRequired = new Set<string>();
    for (const rule of criteria.knockoutRules || []) {
      if (rule.field === 'experienceYears' && rule.operator === 'GTE') {
        const required = Number(rule.value);
        if (!Number.isFinite(required) || candidateExpYears === null) {
          manualReviewRequired.add('Experience requirement is not verified; recruiter review is needed.');
        } else if (candidateExpYears < required) {
          knockoutFailures.push(rule.failureMessage || `Requires minimum ${required} years experience (Candidate has ${candidateExpYears}).`);
        }
      } else {
        manualReviewRequired.add(`${rule.field} knockout must be verified by a reviewer; not evaluated automatically.`);
      }
    }
    if (criteria.educationLevels?.length) manualReviewRequired.add('Education credentials require verification.');
    if (criteria.languages?.length) manualReviewRequired.add('Language proficiency requires verification.');
    if ((criteria.minExperienceYears ?? vacancy.minExperienceYears ?? 0) > 0 && candidateExpYears === null) {
      manualReviewRequired.add('Candidate experience is not recorded; human review is required.');
    }
    const knockoutsPassed = knockoutFailures.length === 0;

    // 2. Evaluate Must-Have Skills
    const skillBreakdown: AtsSkillMatchItem[] = [];
    const missingKeywords: string[] = [];
    let mustHaveMatchedCount = 0;
    const mustHaveTotalCount = criteria.mustHaveSkills.length;

    for (const skill of criteria.mustHaveSkills) {
      const sLower = skill.name.toLowerCase();
      const link = candidateLinkSkills.get(sLower);
      const isEvidenced = Boolean(link?.evidence.length && isSkillLinkActive(candidate.skills ?? undefined, link.skill.name, link.evidence));
      // V1 parity: a self-reported profile skill is not verified match evidence.
      const snippet = (isEvidenced ? link?.evidence[0]?.snippet : null) || findSkillSnippet(combinedCvText, skill.name);
      const matched = isEvidenced || Boolean(snippet);

      if (matched) {
        mustHaveMatchedCount += 1;
      } else {
        missingKeywords.push(skill.name);
      }

      skillBreakdown.push({
        skillName: skill.name,
        isMustHave: true,
        matched,
        evidenceSnippet: snippet || null,
        sourceType: (isEvidenced ? link?.evidence[0]?.sourceType : null) || (snippet ? 'CV_TEXT' : null),
      });
    }

    // 3. Evaluate Nice-to-Have Skills
    let niceToHaveMatchedCount = 0;
    const niceToHaveTotalCount = criteria.niceToHaveSkills.length;

    for (const skill of criteria.niceToHaveSkills) {
      const sLower = skill.name.toLowerCase();
      const link = candidateLinkSkills.get(sLower);
      const isEvidenced = Boolean(link?.evidence.length && isSkillLinkActive(candidate.skills ?? undefined, link.skill.name, link.evidence));
      const snippet = (isEvidenced ? link?.evidence[0]?.snippet : null) || findSkillSnippet(combinedCvText, skill.name);
      const matched = isEvidenced || Boolean(snippet);

      if (matched) {
        niceToHaveMatchedCount += 1;
      } else {
        missingKeywords.push(skill.name);
      }

      skillBreakdown.push({
        skillName: skill.name,
        isMustHave: false,
        matched,
        evidenceSnippet: snippet || null,
        sourceType: (isEvidenced ? link?.evidence[0]?.sourceType : null) || (snippet ? 'CV_TEXT' : null),
      });
    }

    // 4. Calculate Sub-Scores
    const mustHaveRatio = mustHaveTotalCount > 0 ? mustHaveMatchedCount / mustHaveTotalCount : 0;
    const niceToHaveRatio = niceToHaveTotalCount > 0 ? niceToHaveMatchedCount / niceToHaveTotalCount : 0;
    const skillsScore = mustHaveTotalCount > 0 && niceToHaveTotalCount > 0
      ? (mustHaveRatio * 0.8 + niceToHaveRatio * 0.2) * 100
      : (mustHaveTotalCount > 0 ? mustHaveRatio : niceToHaveRatio) * 100;

    const reqExp = criteria.minExperienceYears ?? vacancy.minExperienceYears ?? 0;
    const expKnown = candidateExpYears !== null && Number.isFinite(candidateExpYears);
    const expScore = reqExp > 0 && expKnown ? Math.min((candidateExpYears / reqExp) * 100, 100) : 0;

    const weights = criteria.weights || { skills: 50, experience: 30, education: 10, languages: 10 };
    const skillsWeight = mustHaveTotalCount + niceToHaveTotalCount > 0 ? Math.max(0, weights.skills) : 0;
    const experienceWeight = reqExp > 0 && expKnown ? Math.max(0, weights.experience) : 0;
    const totalWeight = skillsWeight + experienceWeight;

    // Only verifiable evidence contributes to scores. Degree/language data is
    // currently absent and must not earn invented 85/90 placeholder points.
    let computedOverall = totalWeight > 0
      ? ((skillsScore * skillsWeight) + (expScore * experienceWeight)) / totalWeight
      : 0;

    // If knockouts failed, cap score at 49 to highlight blocker, but never auto-reject
    if (!knockoutsPassed) {
      computedOverall = Math.min(computedOverall, 49.0);
    }

    const overallScore = Math.round(computedOverall * 10) / 10;
    const mustHaveSkillsPassed = mustHaveMatchedCount === mustHaveTotalCount;

    const breakdown: AtsMatchBreakdown = {
      overallScore,
      knockoutsPassed,
      knockoutFailures,
      manualReviewRequired: [...manualReviewRequired],
      mustHaveSkillsPassed,
      mustHaveMatchedCount,
      mustHaveTotalCount,
      niceToHaveMatchedCount,
      niceToHaveTotalCount,
      semanticSkillMatchPct: Math.round(skillsScore),
      skillBreakdown,
      missingKeywords,
      experienceMatch: {
        actualYears: candidateExpYears,
        requiredYears: reqExp,
        passed: reqExp > 0 && expKnown ? candidateExpYears >= reqExp : null,
      },
      educationMatch: {
        actual: [],
        required: criteria.educationLevels || [],
        passed: null,
      },
      languagesMatch: {
        actual: [],
        required: (criteria.languages || []).map((l) => l.language),
        passed: null,
      },
      calculatedAt: new Date().toISOString(),
    };

    // Cache to Application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        atsScore: overallScore,
        atsBreakdown: breakdown as unknown as object,
        atsKnockoutPass: knockoutsPassed,
        atsScoredAt: new Date(),
        atsVersion: ATS_VERSION,
      },
    });

    return {
      applicationId,
      candidateId: candidate.id,
      vacancyId: vacancy.id,
      atsScore: overallScore,
      atsKnockoutPass: knockoutsPassed,
      breakdown,
    };
  }

  /**
   * Recommend open jobs for a candidate based on ATS score (Inverted suggestion).
   */
  async getJobRecommendationsForCandidate(
    organizationId: string,
    candidateId: string,
  ): Promise<CandidateJobRecommendation[]> {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
      include: {
        applications: { select: { id: true, vacancyId: true, stage: true } },
        skillLinks: { include: { skill: { select: { name: true } }, evidence: { select: { sourceType: true } } } },
        documents: {
          where: { deletedAt: null, extractionText: { not: null } },
          select: { extractionText: true },
          take: 2,
        },
      },
    });

    if (!candidate) throw new NotFoundException('Candidate not found.');

    const appliedVacancyMap = new Map(
      candidate.applications.map((a) => [a.vacancyId, a.id]),
    );

    const openVacancies = await this.prisma.vacancy.findMany({
      where: {
        organizationId,
        status: { in: ['Open', 'Partially Filled'] },
      },
      include: {
        position: { select: { title: true } },
        branch: { select: { name: true } },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const candidateExp = candidate.experienceYears ?? 0;
    const evidencedSkills = new Set(candidate.skillLinks
      .filter((link) => link.evidence.length > 0 && isSkillLinkActive(candidate.skills ?? undefined, link.skill.name, link.evidence))
      .map((link) => link.skill.name.toLowerCase()));
    const combinedCvText = candidate.documents.map((d) => d.extractionText || '').join('\n');

    const recommendations: CandidateJobRecommendation[] = [];

    for (const vac of openVacancies) {
      const criteria = (vac.jdCriteria as unknown as JdCriteriaDefinition) || null;
      const mustHaves = criteria?.mustHaveSkills?.map((s) => s.name) || vac.requiredSkills || [];

      let matchedCount = 0;
      for (const reqSkill of mustHaves) {
        // Reuse all V1-backed evidence, including screening and scorecard links.
        if (evidencedSkills.has(reqSkill.toLowerCase()) || findSkillSnippet(combinedCvText, reqSkill)) {
          matchedCount += 1;
        }
      }

      const totalSkills = mustHaves.length;
      const skillRatio = totalSkills > 0 ? matchedCount / totalSkills : 0.8;
      const reqExp = vac.minExperienceYears || criteria?.minExperienceYears || 1;
      const expRatio = Math.min(candidateExp / reqExp, 1.0);

      const computedScore = Math.round((skillRatio * 60 + expRatio * 40) * 10) / 10;
      const existingAppId = appliedVacancyMap.get(vac.id);

      recommendations.push({
        vacancyId: vac.id,
        vacancyCode: vac.vacancyCode,
        title: vac.position?.title || 'Open Position',
        department: vac.department || null,
        branchName: vac.branch?.name || null,
        atsScore: computedScore,
        mustHaveMatched: matchedCount >= Math.min(totalSkills, 2),
        matchedSkillsCount: matchedCount,
        totalRequiredSkillsCount: totalSkills,
        alreadyApplied: Boolean(existingAppId),
        existingApplicationId: existingAppId ?? null,
      });
    }

    // Sort: unapplied jobs with highest ATS score first
    recommendations.sort((a, b) => {
      if (a.alreadyApplied !== b.alreadyApplied) {
        return a.alreadyApplied ? 1 : -1;
      }
      return b.atsScore - a.atsScore;
    });

    return recommendations.slice(0, 20);
  }
}
