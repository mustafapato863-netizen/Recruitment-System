import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { JoiningChecklist, type ComplianceItem } from './JoiningChecklist';

describe('JoiningChecklist component', () => {
  const mockItems: ComplianceItem[] = [
    {
      id: 'item-1',
      label: 'SCFHS Professional Registration & License',
      isCompleted: true,
      notes: 'Registration #24-99881',
      completedAt: '2026-08-15T10:00:00.000Z',
    },
    {
      id: 'item-2',
      label: 'National Identity / Iqama Document',
      isCompleted: false,
      notes: null,
      completedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders candidate checklist and marks healthcare items with Clinical Gate badge', () => {
    render(
      <JoiningChecklist
        hiringCaseId="hc-100"
        candidateName="Dr. Sarah Al-Otaibi"
        items={mockItems}
        hiringCaseStatus="Awaiting Joining"
        canConfirmJoining={false}
        onItemToggle={vi.fn()}
        onConfirmJoining={vi.fn()}
      />,
    );

    expect(screen.getByText(/Joining Checklist — Dr. Sarah Al-Otaibi/i)).toBeInTheDocument();
    expect(screen.getByText('SCFHS Professional Registration & License')).toBeInTheDocument();
    expect(screen.getByText('Clinical Gate')).toBeInTheDocument();
    expect(screen.getByText('National Identity / Iqama Document')).toBeInTheDocument();
    expect(screen.getByText(/1\/2 complete/i)).toBeInTheDocument();
  });

  it('handles item toggling through callback', async () => {
    const onItemToggle = vi.fn().mockResolvedValue(undefined);
    render(
      <JoiningChecklist
        hiringCaseId="hc-100"
        candidateName="Dr. Sarah Al-Otaibi"
        items={mockItems}
        hiringCaseStatus="Awaiting Joining"
        canConfirmJoining={false}
        onItemToggle={onItemToggle}
        onConfirmJoining={vi.fn()}
      />,
    );

    const uncompletedCheckbox = screen.getByRole('checkbox', {
      name: /^National Identity \/ Iqama Document/i,
    });
    await userEvent.click(uncompletedCheckbox);

    expect(onItemToggle).toHaveBeenCalledWith('item-2', true);
  });

  it('opens note modal and saves verification notes', async () => {
    const onItemNoteSave = vi.fn().mockResolvedValue(undefined);
    render(
      <JoiningChecklist
        hiringCaseId="hc-100"
        candidateName="Dr. Sarah Al-Otaibi"
        items={mockItems}
        hiringCaseStatus="Awaiting Joining"
        canConfirmJoining={false}
        onItemToggle={vi.fn()}
        onConfirmJoining={vi.fn()}
        onItemNoteSave={onItemNoteSave}
      />,
    );

    const noteBtn = screen.getByRole('button', {
      name: /Attach verification note for National Identity \/ Iqama Document/i,
    });
    await userEvent.click(noteBtn);

    expect(screen.getByText(/Verification Reference: National Identity \/ Iqama Document/i)).toBeInTheDocument();

    const noteInput = screen.getByLabelText(/Verification Notes \/ License Reference/i);
    fireEvent.change(noteInput, { target: { value: 'Iqama verified via Muqeem API' } });

    const saveBtn = screen.getByRole('button', { name: /Save Verification Note/i });
    await userEvent.click(saveBtn);

    expect(onItemNoteSave).toHaveBeenCalledWith('item-2', 'Iqama verified via Muqeem API');
  });

  it('triggers window.print when clicking Print Dossier', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <JoiningChecklist
        hiringCaseId="hc-100"
        candidateName="Dr. Sarah Al-Otaibi"
        items={mockItems}
        hiringCaseStatus="Awaiting Joining"
        canConfirmJoining={false}
        onItemToggle={vi.fn()}
        onConfirmJoining={vi.fn()}
      />,
    );

    const printBtn = screen.getByRole('button', { name: /Print Dossier/i });
    await userEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('enables confirm joining button only when all items are verified and user has permission', async () => {
    const allCompletedItems: ComplianceItem[] = mockItems.map((item) => ({
      ...item,
      isCompleted: true,
    }));

    const onConfirmJoining = vi.fn().mockResolvedValue(undefined);

    render(
      <JoiningChecklist
        hiringCaseId="hc-100"
        candidateName="Dr. Sarah Al-Otaibi"
        items={allCompletedItems}
        hiringCaseStatus="Awaiting Joining"
        canConfirmJoining={true}
        onItemToggle={vi.fn()}
        onConfirmJoining={onConfirmJoining}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirm Joining/i });
    expect(confirmBtn).not.toBeDisabled();

    await userEvent.click(confirmBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
