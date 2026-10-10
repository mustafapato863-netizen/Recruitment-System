import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Search } from 'lucide-react';
import { InputV2, SelectV2 } from '..';
import { axeViolations } from './axe';

describe('InputV2', () => {
  it('label is associated; empty shows placeholder; typing works', async () => {
    const { container } = render(<InputV2 label="Search" placeholder="Search candidates" leadingIcon={<Search />} />);
    const input = screen.getByLabelText('Search');
    expect(input).toHaveAttribute('placeholder', 'Search candidates');
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.keyboard('Ahmed');
    expect(input).toHaveValue('Ahmed');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('error: aria-invalid, described-by message with role alert, data-state', async () => {
    const { container } = render(<InputV2 label="Email" error="Enter a full email address." defaultValue="x@" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const msg = screen.getByRole('alert');
    expect(msg).toHaveTextContent('Enter a full email address.');
    expect(input.getAttribute('aria-describedby')).toBe(msg.id);
    expect(container.querySelector('.rf2-field')).toHaveAttribute('data-state', 'error');
    expect(await axeViolations(container)).toEqual([]);
  });

  it.each([['warning', 'Due soon'], ['success', 'Verified']] as const)('%s message', (tone, text) => {
    const { container } = render(<InputV2 label="F" {...{ [tone]: text }} />);
    expect(container.querySelector('.rf2-field')).toHaveAttribute('data-state', tone);
    expect(screen.getByLabelText('F')).toHaveAccessibleDescription(text);
    expect(screen.getByLabelText('F')).not.toHaveAttribute('aria-invalid');
  });

  it('required, hint, disabled and read-only', async () => {
    render(<><InputV2 label="Name" required hint="As on ID" /><InputV2 label="Dis" disabled /><InputV2 label="RO" readOnly defaultValue="HRIS" /></>);
    expect(screen.getByLabelText(/Name/)).toBeRequired();
    expect(screen.getByLabelText(/Name/)).toHaveAccessibleDescription('As on ID');
    expect(screen.getByLabelText('Dis')).toBeDisabled();
    const ro = screen.getByLabelText('RO');
    expect(ro).toHaveAttribute('readonly');
    await userEvent.type(ro, 'zzz');
    expect(ro).toHaveValue('HRIS');
  });
});

describe('SelectV2', () => {
  it('native select with placeholder, keyboard change, error and disabled', async () => {
    const { container } = render(
      <>
        <SelectV2 label="Site" placeholder="Choose a site" defaultValue="">
          <option value="cairo">Offshore Cairo</option>
          <option value="riyadh">SGH Riyadh</option>
        </SelectV2>
        <SelectV2 label="Grade" error="Grade is required." defaultValue=""><option value="">—</option></SelectV2>
        <SelectV2 label="Locked" disabled defaultValue="a"><option value="a">A</option></SelectV2>
      </>,
    );
    const site = screen.getByRole('combobox', { name: 'Site' });
    await userEvent.selectOptions(site, 'riyadh');
    expect(site).toHaveValue('riyadh');
    expect(screen.getByRole('option', { name: 'Choose a site' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Grade' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'Locked' })).toBeDisabled();
    expect(await axeViolations(container)).toEqual([]);
  });
});
