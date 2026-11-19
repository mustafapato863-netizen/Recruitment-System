import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { TenantScopedGuard } from '../../common/guards/tenant-scoped.guard';
import { MatchingController } from '../matching.controller';

/**
 * V2 ATS reads are sensitive file-level operations. Permission alone is not
 * sufficient: an interviewer/recruiter cannot read another owner's case by ID.
 * Full tenant/ownership behavior is separately exercised in the B1 DB suite.
 */
describe('ATS route access enforcement', () => {
  const routes = [
    ['application score', MatchingController.prototype.getApplicationAts, 'application'],
    ['candidate suggestions', MatchingController.prototype.getCandidateJobRecommendations, 'candidate'],
  ] as const;

  it.each(routes)('%s must use the existing tenant-scoped resource policy', (_label, handler, resource) => {
    expect(Reflect.getMetadata('TENANT_RESOURCE', handler)).toEqual({ resource, param: 'id' });
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards).toContain(TenantScopedGuard);
  });
});
