import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), downloadFileApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

import { JoiningV2 } from '../JoiningV2';
import { OperationalReportsPanel } from '../../components/OperationalReportsPanel';

describe('Phase 3 Frontend Workflows (Tickets 05 & 07)', () => {
  beforeEach(() => {
    api.getApi.mockReset();
    api.downloadFileApi.mockReset();
  });

  it('Ticket 05: JoiningV2 renders This month / Next month expected joiners forecast with verified signed vs pending breakdown and drill-down', async () => {
    const user = userEvent.setup();
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/hiring') return [];
      if (path === '/hiring/forecast') {
        return {
          timezone: 'Africa/Cairo',
          asOf: '2026-12-15',
          thisMonth: {
            month: '2026-12',
            total: 1,
            signed: 0,
            pendingSignature: 1,
            items: [{
              applicationId: 'app-dec',
              hiringCaseId: null,
              offerId: 'off-1',
              candidateName: 'Omar Tarek',
              positionTitle: 'Pharmacist',
              branchId: 'br-1',
              branchName: 'Cairo',
              expectedJoiningDate: '2026-12-22',
              monthKey: '2026-12',
              contractSigned: false,
              stage: 'Offer',
              offerStatus: 'Accepted',
              ownerName: 'Mariam',
            }],
          },
          nextMonth: {
            month: '2027-01',
            total: 1,
            signed: 1,
            pendingSignature: 0,
            items: [{
              applicationId: 'app-jan',
              hiringCaseId: 'hc-1',
              offerId: 'off-2',
              candidateName: 'Nora Adel',
              positionTitle: 'ICU Nurse',
              branchId: 'br-1',
              branchName: 'Cairo',
              expectedJoiningDate: '2027-01-15',
              monthKey: '2027-01',
              contractSigned: true,
              stage: 'Pre-Hire',
              offerStatus: 'Accepted',
              ownerName: 'Mariam',
            }],
          },
        };
      }
      return [];
    });

    render(
      <MemoryRouter initialEntries={['/joinings']}>
        <Routes>
          <Route path="/joinings" element={<JoiningV2 />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('forecast-total-thisMonth')).toHaveTextContent('1');
    expect(screen.getByTestId('forecast-total-nextMonth')).toHaveTextContent('1');
    expect(screen.getByTestId('forecast-card-thisMonth')).toHaveTextContent('1 pending signature');
    expect(screen.getByTestId('forecast-card-nextMonth')).toHaveTextContent('1 verified signed');

    await user.click(screen.getByRole('button', { name: /View next month list/i }));
    const drill = screen.getByTestId('forecast-drilldown');
    expect(drill).toHaveTextContent('Nora Adel');
    expect(drill).toHaveTextContent('2027-01-15');
    expect(drill).toHaveTextContent('Verified signed');
  });

  it('Ticket 07: OperationalReportsPanel renders Vacancy Tracker & Candidate Activity and exports matching Excel with active filters', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/reports/vacancy-tracker')) {
        return {
          range: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.000Z' },
          summary: { totalRequestsCount: 2, openRequestsCount: 2, totalRequestedSeats: 5, totalFilledSeats: 1, totalRemainingSeats: 4 },
          rows: [{
            requestId: 'vr-1',
            requestCode: 'VR-001',
            vacancyId: 'vac-1',
            vacancyCode: 'VAC-001',
            positionTitle: 'ICU Nurse',
            branchId: 'br-1',
            branchName: 'Cairo',
            departmentId: 'dep-1',
            departmentName: 'ICU',
            openingType: 'Replacement',
            ownerName: 'Mariam',
            status: 'Partially Filled',
            isOpen: true,
            approvedAt: '2026-10-01T00:00:00.000Z',
            activatedAt: '2026-10-10T00:00:00.000Z',
            requestedSeats: 3,
            filledSeats: 1,
            remainingSeats: 2,
            vacantDays: 12,
          }],
        };
      }
      if (path.startsWith('/reports/candidate-activity')) {
        return {
          range: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.000Z' },
          totals: { applications: 1, applied: 1, screening: 1, hrInterview: 0, technicalInterview: 1, assessmentInterview: 1, offerSent: 1, offerDeclined: 1, joined: 0 },
          bySource: [{ source: 'LinkedIn', applied: 1, screening: 1, interviews: 1, offerSent: 1, joined: 0 }],
          declineReasons: [{ reason: 'Compensation', count: 1 }],
          rows: [{
            applicationId: 'app-1',
            applicationCode: 'APP-001',
            candidateName: 'Ahmed Ali',
            positionTitle: 'HRIS Dev',
            branchName: 'Cairo',
            departmentName: 'IT',
            source: 'LinkedIn',
            ownerName: 'Mariam',
            currentStage: 'Offer',
            appliedAt: '2026-10-05T10:00:00.000Z',
            applied: true,
            reachedScreening: true,
            reachedHrInterview: false,
            reachedTechnicalInterview: true,
            reachedAssessmentInterview: true,
            offerSent: true,
            offerDeclined: true,
            declineReason: 'Compensation',
            joined: false,
            joinedAt: null,
          }],
        };
      }
      return {};
    });
    api.downloadFileApi.mockResolvedValue({ blob: new Blob(['xlsx']), filename: 'report.xlsx' });

    render(
      <MemoryRouter>
        <OperationalReportsPanel filters={{ month: '2026-10', branchId: 'br-1' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('vt-open-requests')).toHaveTextContent('2');
    expect(screen.getByTestId('vt-remaining-seats')).toHaveTextContent('4');
    expect(screen.queryByText(/Replaced Employee/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export Excel/i }));
    await waitFor(() => expect(api.downloadFileApi).toHaveBeenCalledWith(
      '/reports/vacancy-tracker/export.xlsx?month=2026-10&branchId=br-1',
      'vacancy-tracker.xlsx',
    ));

    await user.click(screen.getByRole('tab', { name: 'Candidate Activity' }));
    expect(await screen.findByTestId('ca-tech')).toHaveTextContent('1');
    expect(screen.getByTestId('ca-assess')).toHaveTextContent('1');
    expect(screen.getByText('Compensation: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export Excel/i }));
    await waitFor(() => expect(api.downloadFileApi).toHaveBeenCalledWith(
      '/reports/candidate-activity/export.xlsx?month=2026-10&branchId=br-1',
      'candidate-activity.xlsx',
    ));

    createUrl.mockRestore();
    revokeUrl.mockRestore();
  });
});
