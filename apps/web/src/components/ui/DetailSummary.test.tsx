import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailSummary } from './DetailSummary';

describe('DetailSummary', () => {
  it('uses a semantic fact list without invalid description-list nesting', () => {
    const { container } = render(
      <DetailSummary
        columns={2}
        items={[
          { label: 'Candidate', value: 'Mariam El-Sayed' },
          { label: 'Current stage', value: 'Interview', hint: 'Updated today' },
        ]}
      />,
    );

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Candidate')).toHaveClass('rf-detail-summary__label');
    expect(screen.getByText('Interview')).toHaveClass('rf-detail-summary__value');
    expect(container.querySelector('dl')).toBeNull();
  });
});
