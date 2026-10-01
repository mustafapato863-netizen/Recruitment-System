import { OffersController } from '../offers.controller';
import type { OffersService } from '../offers.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import type { AuthUser } from '@recruitflow/contracts';

describe('OffersController', () => {
  let controller: OffersController;
  let mockOffersService: Partial<OffersService>;
  let mockUserPermissions: Partial<UserPermissionsService>;

  const mockUser: AuthUser = {
    userId: '10000000-0000-4000-8000-000000000010',
    organizationId: '10000000-0000-4000-8000-000000000001',
    tokenVersion: 1,
    roleCodes: ['RECRUITER'],
  };

  beforeEach(() => {
    mockOffersService = {
      getOffers: vi.fn().mockResolvedValue([
        { id: '20000000-0000-4000-8000-000000000801', offerCode: 'OFF-2024-0001' },
      ]),
    };
    mockUserPermissions = {
      hasPermission: vi.fn().mockResolvedValue(true),
    };

    controller = new OffersController(
      mockOffersService as OffersService,
      mockUserPermissions as UserPermissionsService,
    );
  });

  it('safely handles missing or undefined query parameters without error', async () => {
    const result = await controller.getOffers(mockUser);
    expect(result).toHaveLength(1);
    expect(mockOffersService.getOffers).toHaveBeenCalledWith(
      mockUser,
      {},
      { viewSalary: true },
    );
  });

  it('safely strips "undefined" and "null" string candidateId to prevent P2023 DB error', async () => {
    const resultUndefined = await controller.getOffers(mockUser, undefined, undefined, 'undefined');
    expect(resultUndefined).toHaveLength(1);
    expect(mockOffersService.getOffers).toHaveBeenCalledWith(
      mockUser,
      {},
      { viewSalary: true },
    );

    const resultNull = await controller.getOffers(mockUser, undefined, undefined, 'null');
    expect(resultNull).toHaveLength(1);
  });

  it('returns an empty array when explicitly given an invalid non-UUID candidateId or vacancyId', async () => {
    const resultInvalidCand = await controller.getOffers(mockUser, undefined, undefined, 'not-a-valid-uuid');
    expect(resultInvalidCand).toEqual([]);

    const resultInvalidVac = await controller.getOffers(mockUser, undefined, undefined, undefined, 'invalid-vac-id');
    expect(resultInvalidVac).toEqual([]);
  });

  it('passes through valid UUIDs and strips status ALL', async () => {
    const validUuid = '20000000-0000-4000-8000-000000000200';
    await controller.getOffers(mockUser, 'ALL', '  test candidate  ', validUuid);
    expect(mockOffersService.getOffers).toHaveBeenCalledWith(
      mockUser,
      {
        candidateId: validUuid,
        search: 'test candidate',
      },
      { viewSalary: true },
    );
  });
});
