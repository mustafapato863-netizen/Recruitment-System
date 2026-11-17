import { describe, expect, it } from 'vitest';
import { licenseView } from '../hiring.service';

describe('licence-only case projection', () => {
  it('exposes only licence work and no application identifier or other requirements', () => {
    const row = licenseView({
      id: 'case', applicationId: 'application', status: 'Pending Compliance',
      application: { candidate: { firstName: 'Test', lastName: 'Person' }, vacancy: { position: { title: 'Role' }, branch: { name: 'Site' } } },
      complianceRequirements: [
        { id: 'licence', type: 'License', name: 'Licence', status: 'Pending', isRequired: true, expiryDate: null, verifiedAt: null, documentId: null },
        { id: 'passport', type: 'Document', name: 'Passport', status: 'Pending', isRequired: true, expiryDate: null, verifiedAt: null, documentId: null },
      ],
    });
    expect(Object.keys(row).sort()).toEqual(['branchName', 'candidateName', 'complianceRequirements', 'id', 'positionTitle', 'status']);
    expect(row.complianceRequirements.map((item) => item.id)).toEqual(['licence']);
    expect(JSON.stringify(row)).not.toMatch(/application|Passport/);
  });
});
