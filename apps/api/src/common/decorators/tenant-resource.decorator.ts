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
 * CV read and the attendee's own scorecard routes carry this marker.
 */
export const ALLOW_INTERVIEW_ATTENDEE = 'ALLOW_INTERVIEW_ATTENDEE';
export const AllowInterviewAttendee = () => SetMetadata(ALLOW_INTERVIEW_ATTENDEE, true);
