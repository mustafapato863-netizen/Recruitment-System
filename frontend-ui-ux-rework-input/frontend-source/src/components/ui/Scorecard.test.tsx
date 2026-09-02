import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Scorecard } from './Scorecard';

describe('Scorecard', () => {
  it('supports labelled category regions and keyboard rating changes', async () => {
    const user = userEvent.setup();
    const onRatingChange = vi.fn();
    render(
      <Scorecard
        title="Technical interview"
        interviewer="A. Hassan"
        categories={[{
          id: 'technical',
          name: 'Technical fit',
          isRequired: true,
          criteria: [{ id: 'depth', name: 'Technical depth', rating: 3 }],
        }]}
        onRatingChange={onRatingChange}
      />,
    );

    const category = screen.getByRole('button', { name: /technical fit/i });
    expect(category).toHaveAttribute('aria-controls', 'scorecard-category-technical');
    expect(screen.getByRole('region', { name: 'Technical fit criteria' })).toBeInTheDocument();

    const selectedRating = screen.getByRole('radio', { name: '3' });
    selectedRating.focus();
    await user.keyboard('{ArrowRight}');
    expect(onRatingChange).toHaveBeenCalledWith('technical', 'depth', 4);
    expect(screen.getByRole('radio', { name: '4' })).toHaveFocus();
  });
});
