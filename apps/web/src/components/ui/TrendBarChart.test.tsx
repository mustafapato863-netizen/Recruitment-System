import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrendBarChart } from './TrendBarChart';

describe('TrendBarChart', () => {
  const sampleData = [
    { label: 'Jan', value: 2 },
    { label: 'Feb', value: 4 },
    { label: 'Mar', value: 6 },
    { label: 'Apr', value: 8 },
    { label: 'May', value: 10 },
    { label: 'Jun', value: 12 },
    { label: 'Jul', value: 14 },
    { label: 'Aug', value: 16 },
    { label: 'Sep', value: 18 },
    { label: 'Oct', value: 20 },
    { label: 'Nov', value: 22 },
    { label: 'Dec', value: 24 },
  ];

  it('renders correctly with 6M active range by default (slices last 6 items)', () => {
    render(
      <MemoryRouter>
        <TrendBarChart data={sampleData} />
      </MemoryRouter>
    );
    // In 6M, items are Jul through Dec: total = 14+16+18+20+22+24 = 114
    expect(screen.getByText('114')).toBeInTheDocument();
    expect(screen.getByText('19.0')).toBeInTheDocument(); // avg = 114 / 6 = 19.0
  });

  it('filters data to full 1Y range when 1Y button is clicked', () => {
    render(
      <MemoryRouter>
        <TrendBarChart data={sampleData} />
      </MemoryRouter>
    );
    const oneYearButton = screen.getByRole('button', { name: '1Y' });
    fireEvent.click(oneYearButton);

    // In 1Y, all 12 items: total = 156, avg = 156 / 12 = 13.0
    expect(screen.getByText('156')).toBeInTheDocument();
    expect(screen.getByText('13.0')).toBeInTheDocument();
  });

  it('handles empty data gracefully with 0 total and 0.0 average', () => {
    render(
      <MemoryRouter>
        <TrendBarChart data={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText('Total hires')).toBeInTheDocument();
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.getByText('Goal line')).toBeInTheDocument();
  });
});