import type { PrismaClient } from '@recruitflow/database';

// Terminal stages that should NOT trigger stale-applicant nudges
const TERMINAL_STAGES = new Set(['Joined', 'Rejected', 'Withdrawn']);

// How many days in the same stage before a nudge fires
const STALE_THRESHOLD_DAYS = 7;

export interface SweeperResult {
  staleNudges: number;
  consentExpiries: number;
}

/**
 * C4 — Stale-applicant nudge sweeper.
 *
 * Finds applications that have not changed stage in >STALE_THRESHOLD_DAYS days
 * and are not in a terminal stage. For each such application writes a system
 * ApplicationNote tagged [Automation] visible in the recruiter's timeline.
 *
 * The sweeper is idempotent over a rolling 24-hour window: it will not create
 * a second nudge for the same application within 24 hours.
 */
export async function sweepStaleApplicants(prisma: PrismaClient): Promise<number> {
  const cutoffDate = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const dedupWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const staleApps = await prisma.application.findMany({
    where: {
      stage: { notIn: [...TERMINAL_STAGES] as string[] },
      updatedAt: { lt: cutoffDate },
    },
    include: {
      candidate: { select: { firstName: true, lastName: true } },
      vacancy: { include: { position: { select: { title: true } } } },
    },
    take: 50, // process in bounded batches
  });

  let nudgeCount = 0;

  for (const app of staleApps) {
    // Check if we already wrote a nudge within the dedup window
    const recentNudge = await prisma.applicationNote.findFirst({
      where: {
        applicationId: app.id,
        authorId: null,
        content: { startsWith: '[Automation] Stale applicant' },
        createdAt: { gte: dedupWindow },
      },
    });
    if (recentNudge) continue;

    const candidateName = app.candidate
      ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
      : 'Candidate';
    const daysStale = Math.floor((Date.now() - app.updatedAt.getTime()) / (1000 * 60 * 60 * 24));

    await prisma.applicationNote.create({
      data: {
        organizationId: app.organizationId,
        applicationId: app.id,
        authorId: null,
        content: `[Automation] Stale applicant alert: "${candidateName}" has been in the "${app.stage}" stage for ${daysStale} day(s) with no activity. Please review and take action.`,
      },
    });

    nudgeCount++;
  }

  return nudgeCount;
}

/**
 * C4 — Consent/retention expiry sweeper.
 *
 * Marks candidate documents whose retentionExpiresAt has passed as 'Expired'
 * so they surface in the GDPR/PDPL deletion queue (Phase H).
 */
export async function sweepConsentExpiry(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const result = await prisma.candidateDocument.updateMany({
    where: {
      retentionExpiresAt: { lte: now },
      consentStatus: { not: 'Expired' },
      deletedAt: null,
    },
    data: { consentStatus: 'Expired' },
  });
  return result.count;
}


