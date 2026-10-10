import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUsersAdapter, initials, toUserOption, UserPicker } from '..';
import type { UserOption, UserPickerAdapter } from '..';
import { axeViolations } from './axe';

const PEOPLE: UserOption[] = [
  { id: 'a', name: 'Karim Hassan', detail: 'Manager · IT' },
  { id: 'b', name: 'Mariam Farag', detail: 'Recruiter-offshore' },
  { id: 'c', name: 'Rasha Nabil', detail: 'Recruiter-clinical', disabledReason: 'Invited, not active yet' },
  { id: 'd', name: 'Omar Khalil', detail: 'Admin · HR Systems' },
];

function staticAdapter(list = PEOPLE): UserPickerAdapter & { search: ReturnType<typeof vi.fn> } {
  return {
    search: vi.fn(async (q: string) => list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))),
  };
}

function Single({ adapter }: { adapter: UserPickerAdapter }) {
  const [v, setV] = useState<UserOption | null>(null);
  return <><UserPicker label="Owner" adapter={adapter} value={v} onChange={setV} debounceMs={0} /><output data-testid="val">{v?.id ?? ''}</output></>;
}
function Multi({ adapter, initial = [] as UserOption[] }: { adapter: UserPickerAdapter; initial?: UserOption[] }) {
  const [v, setV] = useState<UserOption[]>(initial);
  return <><UserPicker multiple label="Interviewers" adapter={adapter} value={v} onChange={setV} debounceMs={0} /><output data-testid="val">{v.map((x) => x.id).join(',')}</output></>;
}

afterEach(() => vi.useRealTimers());

describe('UserPicker', () => {
  it('ARIA combobox/listbox wiring and no axe violations when open', async () => {
    const { container } = render(<Single adapter={staticAdapter()} />);
    const input = screen.getByRole('combobox', { name: 'Owner' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const list = await screen.findByRole('listbox', { name: 'Owner' });
    expect(input).toHaveAttribute('aria-controls', list.id);
    await screen.findAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-a$/);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('keyboard: Down/Up skip disabled, Home/End, Enter selects, Escape closes', async () => {
    render(<Single adapter={staticAdapter()} />);
    const input = screen.getByRole('combobox');
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await screen.findAllByRole('option');
    await userEvent.keyboard('{ArrowDown}'); // a -> b
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-b$/);
    await userEvent.keyboard('{ArrowDown}'); // skip c (disabled) -> d
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-d$/);
    await userEvent.keyboard('{Home}');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-a$/);
    await userEvent.keyboard('{End}');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-d$/);
    await userEvent.keyboard('{ArrowUp}'); // skip c -> b
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-b$/);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('val')).toHaveTextContent('b');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('Mariam Farag');
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('type-ahead filters, and disabled options show a reason and cannot be chosen', async () => {
    render(<Single adapter={staticAdapter()} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'ras');
    const opt = await screen.findByRole('option', { name: /Rasha Nabil/ });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(opt).toHaveAttribute('aria-disabled', 'true');
    expect(opt).toHaveTextContent('Invited, not active yet');
    await userEvent.click(opt);
    expect(screen.getByTestId('val')).toHaveTextContent('');
  });

  it('debounces the async search (one call after typing stops)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = staticAdapter();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: 50 });
    function D() { const [v, setV] = useState<UserOption | null>(null); return <UserPicker label="Owner" adapter={adapter} value={v} onChange={setV} debounceMs={300} />; }
    render(<D />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'kar');
    expect(adapter.search).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(320); });
    await waitFor(() => expect(adapter.search).toHaveBeenCalledTimes(1));
    expect(adapter.search).toHaveBeenCalledWith('kar', expect.any(AbortSignal));
  });

  it('multi-select: toggles, renders removable chips, Backspace removes last', async () => {
    render(<Multi adapter={staticAdapter()} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    await userEvent.click(await screen.findByRole('option', { name: /Karim Hassan/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Omar Khalil/ }));
    expect(screen.getByTestId('val')).toHaveTextContent('a,d');
    expect(screen.getByRole('option', { name: /Karim Hassan/ })).toHaveAttribute('aria-selected', 'true');
    const chips = screen.getByRole('list', { name: 'Selected for Interviewers' });
    expect(chips.querySelectorAll('li')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Karim Hassan' }));
    expect(screen.getByTestId('val')).toHaveTextContent('d');
    input.focus();
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByTestId('val')).toHaveTextContent('');
  });

  it('states: loading, error with retry, empty, no results', async () => {
    let resolveIt: (v: UserOption[]) => void = () => undefined;
    const pending: UserPickerAdapter = { search: () => new Promise((r) => { resolveIt = r; }) };
    const { unmount } = render(<Single adapter={pending} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Loading people…', { selector: '[data-picker-state]' })).toBeInTheDocument();
    await act(async () => resolveIt([]));
    expect(await screen.findByText('No people available.')).toBeInTheDocument();
    unmount();

    const failing: UserPickerAdapter = { search: vi.fn(async () => { throw new Error('500'); }) };
    const r2 = render(<Single adapter={failing} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText(/Could not load people/, { selector: '[data-picker-state] *' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    r2.unmount();

    render(<Single adapter={staticAdapter()} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'zzz');
    expect(await screen.findByText('No people match “zzz”.')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'No people match.')).toBe(true);
  });

  it('disabled picker cannot open', async () => {
    const adapter = staticAdapter();
    render(<UserPicker label="Owner" adapter={adapter} value={null} onChange={() => undefined} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole('combobox').parentElement!);
    expect(adapter.search).not.toHaveBeenCalled();
  });
});

describe('users adapter', () => {
  const record = {
    id: 'u1', email: 'karim@x.test', displayName: 'Karim Hassan', jobTitle: 'Manager · IT', status: 'Active', organizationId: 'o',
    managerId: null, roles: [{ id: 'r', code: 'MANAGER', name: 'Manager' }], lastLoginAt: null, createdAt: '', updatedAt: '',
    // a stray sensitive field must never reach the option
    currentSalary: 99999,
  };

  it.each(['/users/assignable', '/users/interviewers'] as const)('calls %s once, maps UserRecord, filters client-side', async (path) => {
    const fetcher = vi.fn(async () => [record, { ...record, id: 'u2', displayName: 'Mariam Farag', jobTitle: null, roles: [{ id: 'r2', code: 'RECRUITER', name: 'Recruiter-offshore' }] }]);
    const adapter = createUsersAdapter(path, fetcher);
    const ctrl = new AbortController();
    const all = await adapter.search('', ctrl.signal);
    const some = await adapter.search('mariam', ctrl.signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(path);
    expect(all).toEqual([{ id: 'u1', name: 'Karim Hassan', detail: 'Manager · IT' }, { id: 'u2', name: 'Mariam Farag', detail: 'Recruiter-offshore' }]);
    expect(some.map((o) => o.id)).toEqual(['u2']);
    expect(JSON.stringify(all)).not.toMatch(/salary|99999|email/i);
  });

  it('accepts a { data } envelope and retries after a failure', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: [record] });
    const adapter = createUsersAdapter('/users/assignable', fetcher);
    const ctrl = new AbortController();
    await expect(adapter.search('', ctrl.signal)).rejects.toThrow('down');
    expect((await adapter.search('', ctrl.signal))[0].name).toBe('Karim Hassan');
  });

  it('helpers', () => {
    expect(initials('Karim  Hassan')).toBe('KH');
    expect(initials('Omar')).toBe('O');
    expect(toUserOption({ id: 'x', displayName: '', email: 'a@b.c', jobTitle: null, roles: [] })).toEqual({ id: 'x', name: 'a@b.c', detail: undefined });
  });
});
