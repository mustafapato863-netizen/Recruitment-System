import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionAwareButton } from './PermissionAwareButton';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      permissions: ['CANDIDATE_VIEW'],
      roles: [],
    },
  }),
}));

describe('PermissionAwareButton', () => {
  it('renders a normal button when permission is present', () => {
    render(
      <PermissionAwareButton requiredPermission="CANDIDATE_VIEW">
        View
      </PermissionAwareButton>,
    );
    expect(screen.getByRole('button', { name: 'View' })).toBeEnabled();
  });

  it('disables and explains missing permission', () => {
    render(
      <PermissionAwareButton requiredPermission="CANDIDATE_CREATE">
        Create
      </PermissionAwareButton>,
    );
    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).toBeDisabled();
    expect(button.closest('span')).toHaveAttribute('title', expect.stringContaining('CANDIDATE_CREATE'));
  });
});
