/**
 * Phase 4: cancellation and capacity changes name their effect before they write.
 * A commitment is an interview that is still scheduled, a sent or accepted offer
 * on an open application, or a hiring case that is awaiting joining.
 * Completed hires and history are never part of the closable set.
 */

export const RESOLVED_INTERVIEW_STATUSES = ['Cancelled', 'Completed', 'No-show'] as const;
export const COMMITMENT_OFFER_STATUSES = ['Sent', 'Accepted'] as const;
export const JOINING_COMMITMENT_STATUS = 'Awaiting Joining';

export type CommitmentKind = 'interview' | 'offer' | 'joining';

export interface CommitmentRef {
  kind: CommitmentKind;
  id: string;
  label: string;
  status: string;
  applicationId: string;
}

export interface CancellationImpact {
  canClose: boolean;
  commitments: CommitmentRef[];
  activeApplications: number;
  joinedApplications: number;
  message: string;
}

export interface CapacityImpact {
  blocked: boolean;
  current: number;
  next: number;
  joined: number;
  openApplications: number;
  message: string;
}

export function isUnresolvedInterview(status: string): boolean {
  return !(RESOLVED_INTERVIEW_STATUSES as readonly string[]).includes(status);
}

export function isCommitmentOffer(status: string): boolean {
  return (COMMITMENT_OFFER_STATUSES as readonly string[]).includes(status);
}

function noun(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function buildCancellationImpact(input: {
  interviews: Array<{ id: string; title: string; status: string; applicationId: string }>;
  offers: Array<{ id: string; code: string; status: string; applicationId: string }>;
  joining: Array<{ id: string; status: string; applicationId: string; candidateName: string }>;
  activeApplications: number;
  joinedApplications: number;
}): CancellationImpact {
  const commitments: CommitmentRef[] = [];
  for (const interview of input.interviews) {
    if (!isUnresolvedInterview(interview.status)) continue;
    commitments.push({
      kind: 'interview',
      id: interview.id,
      label: interview.title || 'Interview',
      status: interview.status,
      applicationId: interview.applicationId,
    });
  }
  for (const offer of input.offers) {
    if (!isCommitmentOffer(offer.status)) continue;
    commitments.push({
      kind: 'offer',
      id: offer.id,
      label: offer.code || 'Offer',
      status: offer.status,
      applicationId: offer.applicationId,
    });
  }
  for (const row of input.joining) {
    if (row.status !== JOINING_COMMITMENT_STATUS) continue;
    commitments.push({
      kind: 'joining',
      id: row.id,
      label: row.candidateName || 'Awaiting joining',
      status: row.status,
      applicationId: row.applicationId,
    });
  }

  const active = input.activeApplications;
  const joined = input.joinedApplications;
  if (commitments.length === 0) {
    return {
      canClose: true,
      commitments,
      activeApplications: active,
      joinedApplications: joined,
      message: `No unresolved interview, offer, or joining commitments. Closing rejects ${noun(active, 'open application', 'open applications')}. ${noun(joined, 'joined hire stays', 'joined hires stay')}, and history stays.`,
    };
  }

  const interviews = commitments.filter((c) => c.kind === 'interview').length;
  const offers = commitments.filter((c) => c.kind === 'offer').length;
  const joining = commitments.filter((c) => c.kind === 'joining').length;
  const parts = [
    interviews ? noun(interviews, 'interview', 'interviews') : null,
    offers ? noun(offers, 'offer', 'offers') : null,
    joining ? noun(joining, 'joining commitment', 'joining commitments') : null,
  ].filter(Boolean);
  return {
    canClose: false,
    commitments,
    activeApplications: active,
    joinedApplications: joined,
    message: `Resolve ${parts.join(', ')} before this job can close. ${noun(active, 'open application stays', 'open applications stay')} until then. ${noun(joined, 'joined hire stays', 'joined hires stay')}, and history stays.`,
  };
}

export function capacityReductionImpact(input: {
  current: number;
  next: number;
  joined: number;
  openApplications: number;
}): CapacityImpact {
  const blocked = input.next < input.joined;
  const open = noun(input.openApplications, 'open application stays', 'open applications stay');
  const joined = noun(input.joined, 'joined hire stays', 'joined hires stay');
  return {
    blocked,
    current: input.current,
    next: input.next,
    joined: input.joined,
    openApplications: input.openApplications,
    message: blocked
      ? `Approved capacity cannot drop below ${input.joined} already joined. ${joined}. ${open} on the job.`
      : `Capacity changes from ${input.current} to ${input.next}. ${joined}. ${open} on the job.`,
  };
}
