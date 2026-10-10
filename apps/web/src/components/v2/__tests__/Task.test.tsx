import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskRow, TaskSection } from '../Task';
import { axeViolations } from './axe';

describe('TaskSection / TaskRow', () => {
  it('labels the section by its title, counts tasks and lists rows', async () => {
    const { container } = render(
      <TaskSection title="Overdue" count={1} tone="danger">
        <TaskRow icon={<svg />} title="Scorecard missing — Ahmed" meta="HRIS Developer" due="Due 7 Oct" dueTone="danger" action={<a href="/x">Open file</a>} />
      </TaskSection>,
    );
    const region = screen.getByRole('region', { name: 'Overdue' });
    expect(within(region).getByLabelText('1 task')).toHaveTextContent('1');
    expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    expect(within(region).getByText('Due 7 Oct').closest('[data-tone]')).toHaveAttribute('data-tone', 'danger');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows the empty text when there are no rows', () => {
    render(<TaskSection title="Today" count={0} emptyText="Nothing today." />);
    expect(screen.getByText('Nothing today.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
