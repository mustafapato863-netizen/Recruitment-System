import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getStatusTone, StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('maps workflow and priority states without substring collisions', () => {
    expect(getStatusTone('Inactive')).toBe('neutral');
    expect(getStatusTone('Accepted')).toBe('success');
    expect(getStatusTone('Pending Approval')).toBe('warning');
    expect(getStatusTone('Scheduled')).toBe('info');
    expect(getStatusTone('High')).toBe('danger');
  });

  it('always renders the status as text in addition to color', () => {
    render(<StatusBadge status="Rejected" />);
    expect(screen.getByText('Rejected')).toBeVisible();
  });
});
