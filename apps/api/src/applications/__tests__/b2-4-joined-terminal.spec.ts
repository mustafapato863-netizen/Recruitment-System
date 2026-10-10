/** B2-4: Joined is terminal: no move, not even to Rejected; 409 FILE_CLOSED. */
import { describe, expect, it } from 'vitest';
import { ApplicationsService, CLOSED_STAGES } from '../applications.service';

describe('B2-4 closed files do not move', () => {
  it.each(CLOSED_STAGES)('%s -> Rejected is 409 FILE_CLOSED', async (stage) => {
    const svc = Object.create(ApplicationsService.prototype) as ApplicationsService;
    (svc as unknown as { getApplication: () => Promise<unknown> }).getApplication = async () => ({ id: 'a1', stage, version: 3 });
    await expect(svc.updateStage('org', 'a1', 'u1', { stage: 'Rejected', expectedStage: stage, expectedVersion: 3, reason: 'Not qualified' } as never))
      .rejects.toMatchObject({ status: 409, response: { code: 'FILE_CLOSED' } });
  });
});
