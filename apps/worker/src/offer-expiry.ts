import type { PrismaClient } from '@recruitflow/database';

/**
 * B5: hook for time-based offer expiry. OFF by default (OFFER_AUTO_EXPIRE=true
 * turns it on): v2 leaves the expiry rule open, so expiry is manual for now
 * (PATCH /offers/:id/status {status: "Expired"}). When on, a Sent offer whose
 * current version's offerExpiry has passed becomes Expired (offer + version).
 */
export function offerAutoExpireFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.OFFER_AUTO_EXPIRE ?? 'false').toLowerCase() === 'true';
}

type ExpiryPrisma = Pick<PrismaClient, 'offer' | 'offerVersion' | '$transaction'>;

export async function expireOverdueOffers(prisma: ExpiryPrisma, now: Date, enabled = offerAutoExpireFromEnv()): Promise<number> {
  if (!enabled) return 0;
  const sent = await prisma.offer.findMany({
    where: { status: 'Sent', versions: { some: { offerExpiry: { lt: now } } } },
    select: { id: true, currentVersionId: true, versions: { select: { id: true, offerExpiry: true } } },
  });
  const due = sent.filter((o) => {
    const v = o.versions.find((x) => x.id === o.currentVersionId);
    return Boolean(v?.offerExpiry && v.offerExpiry < now);
  });
  let expired = 0;
  for (const offer of due) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.offer.updateMany({ where: { id: offer.id, status: 'Sent' }, data: { status: 'Expired' } });
      if (changed.count === 1 && offer.currentVersionId) {
        await tx.offerVersion.update({ where: { id: offer.currentVersionId }, data: { status: 'Expired' } });
        expired += 1;
      }
    });
  }
  return expired;
}
