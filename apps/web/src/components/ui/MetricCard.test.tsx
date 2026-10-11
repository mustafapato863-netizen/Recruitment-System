import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('uses compact density classes by default', () => {
    const { container } = render(<MetricCard label="Open roles" value={12} />);
    expect(screen.getByText('Open roles')).toHaveClass('rf-metric-label');
    expect(screen.getByText('12')).toHaveClass('rf-metric-value');
    expect(container.querySelector('article')).toHaveClass('rf-metric-card-pad');
  });

  it('keeps legacy sizing when density is default', () => {
    render(<MetricCard label="Pipeline" value={3} density="default" />);
    expect(screen.getByText('Pipeline')).not.toHaveClass('rf-metric-label');
    expect(screen.getByText('3')).not.toHaveClass('rf-metric-value');
  });
});
