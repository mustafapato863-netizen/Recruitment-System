import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PipelineStepper } from './PipelineStepper';

describe('PipelineStepper', () => {
  it('exposes its horizontal progress region to keyboard users', () => {
    render(<PipelineStepper currentStage="Interview" />);

    expect(screen.getByRole('region', { name: 'Pipeline progress' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('Interview').closest('li')).toHaveAttribute('aria-current', 'step');
  });
});
