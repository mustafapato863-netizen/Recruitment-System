import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListChecks } from 'lucide-react';
import { CardV2, EmptyStateV2, ForbiddenStateV2, NavItem, NavList, SkeletonV2, StatusChip, TableCellV2, TableRowV2, TableV2 } from '..';
import type { StatusTone } from '..';
import { axeViolations } from './axe';

describe('StatusChip', () => {
  it.each<StatusTone>(['success', 'warning', 'danger', 'info', 'neutral'])('tone %s has icon + text, no axe violations', async (tone) => {
    const { container } = render(<StatusChip tone={tone} label={`Label ${tone}`} />);
    const chip = container.querySelector('.rf2-chip')!;
    expect(chip).toHaveClass(`rf2-chip--${tone}`);
    expect(chip).toHaveTextContent(`Label ${tone}`);
    expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('NavItem', () => {
  it('selected uses aria-current=page and renders a badge with a label', async () => {
    const { container } = render(
      <NavList label="Primary">
        <NavItem href="/my-work" icon={<ListChecks />} label="My Work" active badge={3} badgeLabel="3 open tasks" />
        <NavItem href="/jobs" icon={<ListChecks />} label="Open jobs" />
      </NavList>,
    );
    expect(screen.getByRole('link', { name: /My Work/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Open jobs' })).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('3 open tasks')).toHaveTextContent('3');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('not permitted → absent (no locked state)', () => {
    render(
      <NavList label="Primary">
        <NavItem href="/users" icon={<ListChecks />} label="Users" permitted={false} />
        <NavItem href="/my-work" icon={<ListChecks />} label="My Work" />
      </NavList>,
    );
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(document.querySelector('[aria-disabled]')).toBeNull();
  });

  it('asChild renders through a custom link element', () => {
    render(<NavItem asChild icon={<ListChecks />} label="My Work" active><a href="/x" data-testid="custom" /></NavItem>);
    const link = screen.getByTestId('custom');
    expect(link).toHaveClass('rf2-nav-item');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveTextContent('My Work');
  });

  it('is reachable by keyboard', async () => {
    render(<NavItem href="/a" icon={<ListChecks />} label="A" />);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'A' })).toHaveFocus();
  });
});

describe('CardV2', () => {
  it('static card is a section with a heading', async () => {
    const { container } = render(<CardV2 title="HRIS Developer">Body</CardV2>);
    expect(screen.getByRole('heading', { name: 'HRIS Developer' })).toBeInTheDocument();
    expect(container.querySelector('section.rf2-card')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('interactive card: button, selected, disabled, keyboard', async () => {
    const onClick = vi.fn();
    const { container } = render(<><CardV2 as="button" title="Open" selected onClick={onClick}>x</CardV2><CardV2 as="button" title="Off" disabled>y</CardV2></>);
    const card = screen.getByRole('button', { name: /Open/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.tab();
    expect(card).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Off/ })).toBeDisabled();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('TableV2 / TableRowV2', () => {
  function Fixture({ onActivate }: { onActivate: () => void }) {
    return (
      <TableV2 label="Files" columns={[{ key: 'n', header: 'Name' }, { key: 'd', header: 'Days', numeric: true }]}>
        <TableRowV2 onActivate={onActivate}><TableCellV2 primary>Ahmed</TableCellV2><TableCellV2 numeric>3</TableCellV2></TableRowV2>
        <TableRowV2 selected><TableCellV2>Lina</TableCellV2><TableCellV2 numeric>1</TableCellV2></TableRowV2>
        <TableRowV2 disabled onActivate={onActivate}><TableCellV2>Closed</TableCellV2><TableCellV2 numeric>9</TableCellV2></TableRowV2>
      </TableV2>
    );
  }

  it('semantic table, headers, numeric cells, no axe violations', async () => {
    const { container } = render(<Fixture onActivate={() => undefined} />);
    expect(screen.getByRole('table', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByText('3')).toHaveAttribute('data-numeric');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('interactive row activates by click, Enter and Space; disabled row does not', async () => {
    const onActivate = vi.fn();
    render(<Fixture onActivate={onActivate} />);
    const [, row, selectedRow, disabledRow] = screen.getAllByRole('row');
    expect(row).toHaveAttribute('tabindex', '0');
    await userEvent.click(row);
    row.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(3);
    expect(selectedRow).toHaveAttribute('aria-selected', 'true');
    expect(disabledRow).toHaveAttribute('aria-disabled', 'true');
    expect(disabledRow).not.toHaveAttribute('tabindex');
    await userEvent.click(disabledRow);
    expect(onActivate).toHaveBeenCalledTimes(3);
  });
});

describe('Page states', () => {
  it('Empty, Forbidden and Skeleton are accessible', async () => {
    const { container } = render(
      <main>
        <EmptyStateV2 title="No open work assigned to you" body="Nothing yet." />
        <ForbiddenStateV2 />
        <SkeletonV2 label="Loading files" />
      </main>,
    );
    expect(screen.getByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/do not have access/);
    const sk = screen.getByRole('status', { name: 'Loading files' });
    expect(sk).toHaveAttribute('aria-busy', 'true');
    expect(await axeViolations(container)).toEqual([]);
  });
});
