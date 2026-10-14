import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListChecks } from 'lucide-react';
import { TabsV2 } from '..';
import { axeViolations } from './axe';

const items = [
  { key: 'actions', label: 'Next actions' },
  { key: 'interviews', label: 'Upcoming interviews' },
  { key: 'joining', label: 'Joining soon', disabled: true },
];

describe('TabsV2', () => {
  it('selects the active tab and moves across enabled tabs with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<TabsV2 ariaLabel="My Work sections" activeKey="actions" onChange={onChange} items={items} />);
    const current = screen.getByRole('tab', { name: 'Next actions' });
    expect(current).toHaveAttribute('aria-selected', 'true');
    expect(current).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Upcoming interviews' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Joining soon' })).toBeDisabled();
    current.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('interviews');
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('actions');
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('interviews');
    await userEvent.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(onChange).not.toHaveBeenCalledWith('joining');
  });

  it('keeps an optional icon out of the accessible name', async () => {
    const { container } = render(
      <TabsV2 ariaLabel="My Work sections" activeKey="actions" onChange={() => {}} items={[{ key: 'actions', label: 'Next actions', icon: <ListChecks /> }]} />,
    );
    const tab = screen.getByRole('tab', { name: 'Next actions' });
    expect(tab.querySelector('.rf2-tab__icon')).toHaveAttribute('aria-hidden', 'true');
    expect(tab.querySelector('svg')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
});
