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
  it('allows template access with MASTER_DATA_MANAGE or operational recruitment permissions', () => {
    expect(getNavigationCatalogItem('email-templates')?.requiredAnyPermissions).toContain('MASTER_DATA_MANAGE');
    expect(getNavigationCatalogItem('email-templates')?.requiredAnyPermissions).toContain('APPLICATION_VIEW');
    expect(getNavigationCatalogItem('whatsapp-templates')?.requiredAnyPermissions).toContain('MASTER_DATA_MANAGE');
    expect(getNavigationCatalogItem('whatsapp-templates')?.requiredAnyPermissions).toContain('APPLICATION_VIEW');
  });

  it('allows command center access with operational recruitment permissions', () => {
    expect(getNavigationCatalogItem('dashboard')?.requiredAnyPermissions).toContain('VACANCY_VIEW');
    expect(getNavigationCatalogItem('dashboard')?.requiredAnyPermissions).toContain('APPLICATION_VIEW');
  });

  it('has unique keys and routes', () => {
    const keys = NAVIGATION_CATALOG.map((item) => item.key);
    const routes = NAVIGATION_CATALOG.map((item) => item.route);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
