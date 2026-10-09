import { SetMetadata } from '@nestjs/common';

/**
 * Sets metadata for TenantScopedGuard indicating which resource policy
 * and route parameter should be used for tenant verification.
 *
 * The `resource` key must match an entry in TENANT_RESOURCE_POLICIES.
 * The `param` key specifies which route parameter holds the resource ID.
 *
 * @example
 *   @TenantResource({ resource: 'candidate', param: 'id' })
 */
export const TenantResource = (options: { resource: string; param: string }) =>
  SetMetadata('TENANT_RESOURCE', options);

/**
 * B1 interviewer exception: on an `interview` file route, an attendee of that
 * interview who does not otherwise own the file is allowed through. Only the
 * CV read, the attendee's own scorecard, RSVP and .ics routes carry this marker.
 */
export const ALLOW_INTERVIEW_ATTENDEE = 'ALLOW_INTERVIEW_ATTENDEE';
export const AllowInterviewAttendee = () => SetMetadata(ALLOW_INTERVIEW_ATTENDEE, true);

/**
 * B1 follow-up (Mustafa #2): on a read-only file route (application, offer,
 * hiring case) or a candidate-document read, a user who is currently the
 * assigned/pending offer or final-hire approver for that file is allowed
 * through even without owning it. Never put this on a route that edits the
 * file; the only write carrying it is the approver's own final-hire decision
 * (POST /hiring/:id/final-approval), which the service re-authorizes.
 */
export const ALLOW_FILE_APPROVER = 'ALLOW_FILE_APPROVER';
export const AllowFileApprover = () => SetMetadata(ALLOW_FILE_APPROVER, true);
