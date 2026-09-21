import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_CATALOG,
  formatPermissionRequirement,
  getNavigationCatalogItem,
  getPermissionLabel,
} from '@recruitflow/contracts';

describe('permission labels', () => {
  it('maps known codes to human labels', () => {
    expect(getPermissionLabel('VACANCY_VIEW')).toBe('View Vacancies');
  });

  it('formats single and any-of requirements', () => {
    expect(formatPermissionRequirement({ requiredPermission: 'CANDIDATE_CREATE' })).toContain('CANDIDATE_CREATE');
    expect(formatPermissionRequirement({
      requiredAnyPermissions: ['APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL'],
    })).toContain(' or ');
  });
});

describe('NAVIGATION_CATALOG', () => {
  it('keeps email-templates on MASTER_DATA_MANAGE', () => {
    expect(getNavigationCatalogItem('email-templates')?.requiredPermission).toBe('MASTER_DATA_MANAGE');
  });

  it('has unique keys and routes', () => {
    const keys = NAVIGATION_CATALOG.map((item) => item.key);
    const routes = NAVIGATION_CATALOG.map((item) => item.route);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
