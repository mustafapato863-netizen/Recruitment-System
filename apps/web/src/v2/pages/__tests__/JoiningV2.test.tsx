import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../api/client';
import { JoiningV2 } from '../JoiningV2';

vi.mock('../../../api/client', () => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const mockHiringCases = [
  {
    id: 'case-1',
    candidateName: 'Ahmed Mansour',
    positionTitle: 'Senior Registered Nurse',
    branchName: 'SGH Dubai',
    plannedJoiningDate: '2026-12-01T08:00:00.000Z',
    status: 'Awaiting Joining',
    approvedHeadcount: 5,
    joinedHeadcount: 2,
    complianceRequirements: [
      { id: 'req-1', name: 'SCFHS Medical License', isRequired: true, status: 'Verified' },
      { id: 'req-2', name: 'Criminal Background Clearance', isRequired: true, status: 'Pending' },
    ],
  },
  {
    id: 'case-2',
    candidateName: 'Fatima Zahra',
    positionTitle: 'Consultant Radiologist',
    branchName: 'SGH Riyadh',
    plannedJoiningDate: '2026-11-20T08:00:00.000Z',
    status: 'Joined',
    approvedHeadcount: 2,
    joinedHeadcount: 2,
    complianceRequirements: [
      { id: 'req-3', name: 'DHA Specialist License', isRequired: true, status: 'Verified' },
    ],
  },
];

describe('JoiningV2 & OnboardingChecklistDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getApi).mockResolvedValue(mockHiringCases);
  });

  it('renders summary cards, table rows, and filters correctly', async () => {
    render(
      <MemoryRouter initialEntries={['/joinings']}>
        <JoiningV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ahmed Mansour')).toBeInTheDocument();
    expect(screen.getByText('Fatima Zahra')).toBeInTheDocument();

    // Summary counts
    expect(screen.getAllByText('Awaiting Joining').length).toBeGreaterThan(0);
    expect(screen.getByText('Senior Registered Nurse')).toBeInTheDocument();
    expect(screen.getByText('SGH Dubai')).toBeInTheDocument();
  });

  it('filters by status when clicking status tabs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/joinings']}>
        <JoiningV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ahmed Mansour')).toBeInTheDocument();

    const joinedTab = screen.getByRole('tab', { name: /Joined/ });
    await user.click(joinedTab);

    // Fatima should be present, Ahmed should be filtered out
    await waitFor(() => {
      expect(screen.queryByText('Ahmed Mansour')).not.toBeInTheDocument();
      expect(screen.getByText('Fatima Zahra')).toBeInTheDocument();
    });
  });

  it('opens onboarding drawer and submits joining update', async () => {
    const user = userEvent.setup();
    vi.mocked(client.postApi).mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={['/joinings']}>
        <JoiningV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ahmed Mansour')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm joining' });
    await user.click(confirmBtn);

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText(/Onboarding & Joining: Ahmed Mansour/)).toBeInTheDocument();

    const submitBtn = within(drawer).getByRole('button', { name: 'Record Joining Status' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(client.postApi).toHaveBeenCalledWith(
        '/hiring/case-1/joining',
        expect.objectContaining({ status: 'Joined' }),
      );
    });
  });
});
