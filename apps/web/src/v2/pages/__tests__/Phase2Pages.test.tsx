import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileResponses } from '../../api/__fixtures__/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
const authState = vi.hoisted(() => ({
  user: { id: 'u-mariam', displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW', 'VACANCY_VIEW'] as string[] },
}));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));

import { MessagesCard } from '../FileHistory';
import { ScreeningPageV2, computeSalaryFit } from '../ScreeningPageV2';
import { ScorecardPageV2, averageObservedRating } from '../ScorecardPageV2';

describe('Phase 2 Frontend Workflows (Tickets 08, 11, 12, 13, 04)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    authState.user.id = 'u-mariam';
  });

  it('Ticket 08: enables Open in WhatsApp for masked phone via server link without mutating sent counts', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    api.postApi.mockResolvedValueOnce({
      waLink: 'https://wa.me/966501234567?text=Hello%20Nora',
      message: 'Hello Nora',
      templateId: 'tpl-1',
      templateName: 'Invite',
    });

    render(
      <MessagesCard
        applicationId="app-1"
        followUpDate={null}
        omitAttempts
        read={{
          status: 'ready',
          data: {
            followUpDate: null,
            destination: 'local@test',
            templates: [],
            attempts: [],
            whatsappReady: true,
            whatsappTemplates: [
              { id: 'tpl-1', name: 'Invite', category: 'interview_invite', bodyTemplate: 'Hello {{candidateName}}' },
            ],
          },
        }}
        whatsappContext={{
          phone: '•••• •••• 4567',
          candidateName: 'Nora Adel',
          stageName: 'Interview',
        }}
      />,
    );

    expect(screen.getByText('•••• •••• 4567')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Open in WhatsApp' });
    expect(btn).toBeEnabled();
    await user.click(btn);

    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/applications/app-1/whatsapp-link', { templateId: 'tpl-1' }));
    expect(openSpy).toHaveBeenCalledWith('https://wa.me/966501234567?text=Hello%20Nora', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('Ticket 11: computeSalaryFit handles inclusive bounds, currency/period mismatch, and missing range', () => {
    const range = { min: 10000, max: 15000, currency: 'SAR', period: 'Monthly' as const };
    expect(computeSalaryFit('10000', 'SAR', 'Monthly', range)).toBe('within');
    expect(computeSalaryFit('15000', 'SAR', 'Monthly', range)).toBe('within');
    expect(computeSalaryFit('9500', 'SAR', 'Monthly', range)).toBe('below');
    expect(computeSalaryFit('16000', 'SAR', 'Monthly', range)).toBe('above');
    expect(computeSalaryFit('12000', 'EGP', 'Monthly', range)).toBe('not_comparable');
    expect(computeSalaryFit('12000', 'SAR', 'Annual', range)).toBe('not_comparable');
    expect(computeSalaryFit('12000', 'SAR', 'Monthly', null)).toBe('range_missing');
  });

  it('Ticket 11: ScreeningPageV2 requires expected salary before moving to Interview and allows out-of-range advisory move', async () => {
    const user = userEvent.setup();
    const fixtures = fileResponses('applied');
    api.getApi.mockImplementation(async (path: string) => {
      const p = path.split('?')[0];
      if (p === '/screening/application/a1/context') {
        return {
          applicationId: 'a1',
          stage: 'Applied',
          candidateName: 'Ahmed Embaby',
          positionTitle: 'HRIS Developer',
          vacancySalaryRange: { min: 10000, max: 15000, currency: 'SAR', period: 'Monthly' },
          latestExpectedSalary: null,
          salaryFit: 'not_recorded',
        };
      }
      if (p === '/screening/application/a1/draft') return null;
      if (p in fixtures) return structuredClone(fixtures[p]);
      return [];
    });
    api.postApi.mockResolvedValue({ id: 'scr-1' });
    api.patchApi.mockResolvedValue({ version: 8 });

    render(
      <MemoryRouter initialEntries={['/applications/a1/screening']}>
        <Routes>
          <Route path="/applications/:id/screening" element={<ScreeningPageV2 />} />
          <Route path="/applications/:id" element={<div>Application File Reached</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('vacancy-salary-range')).toHaveTextContent('10,000 – 15,000 SAR / Monthly');
    await user.type(screen.getByLabelText(/Evidence source/i), 'Phone call');
    await user.type(screen.getByLabelText(/Screen note/i), 'Strong clinical IT background.');

    // Missing expected salary blocks Move to interview
    await user.click(screen.getByRole('button', { name: 'Save and move to Interview' }));
    expect(screen.getByText(/Expected salary is required before moving to Interview/i)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();

    // Entering an above-range salary shows warning but still allows advancing
    await user.type(screen.getByLabelText(/Expected salary/i), '18000');
    expect(screen.getByTestId('salary-fit-status')).toHaveTextContent('Above vacancy salary range');
    await user.click(screen.getByRole('button', { name: 'Save and move to Interview' }));

    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/screening', expect.objectContaining({
      applicationId: 'a1',
      expectedSalary: 18000,
      salaryCurrency: 'SAR',
      salaryPeriod: 'Monthly',
    })));
    expect(await screen.findByText('Application File Reached')).toBeInTheDocument();
  });

  it('Ticket 13: ScorecardPageV2 supports SGH sections, excludes Not observed from average, and submits payload', async () => {
    const user = userEvent.setup();
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/interviews/iv-9') {
        return {
          id: 'iv-9',
          interviewCode: 'INT-9',
          applicationId: 'a1',
          title: 'Pre-Hire Assessment: Ahmed Embaby',
          interviewType: 'Assessment',
          stageContext: 'Pre-Hire',
          scheduledStart: '2026-10-01T09:00:00.000Z',
          scheduledEnd: '2026-10-01T10:00:00.000Z',
          timezone: 'Africa/Cairo',
          status: 'Scheduled',
          attendees: [
            { userId: 'u-mariam', displayName: 'Mariam Farag' },
            { userId: 'u-karim', displayName: 'Karim Hassan' },
          ],
        };
      }
      if (path === '/interviews/iv-9/scorecard') return [];
      return [];
    });
    api.postApi.mockResolvedValue({ id: 'sc-9' });

    render(
      <MemoryRouter initialEntries={['/interviews/iv-9/scorecard']}>
        <Routes>
          <Route path="/interviews/:id/scorecard" element={<ScorecardPageV2 />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /SGH Evaluation/i })).toBeInTheDocument();
    expect(screen.getByText('Pre-hire assessment')).toBeInTheDocument();
    expect(screen.getByText('Karim Hassan')).toBeInTheDocument();

    // Verify averageObservedRating excludes Not observed items
    const calc = averageObservedRating({
      a: { rating: 4, notObserved: false, comment: '' },
      b: { rating: null, notObserved: true, comment: '' },
      c: { rating: 5, notObserved: false, comment: '' },
    });
    expect(calc).toEqual({ avg: 4.5, observedCount: 2, notObservedCount: 1 });

    // Mark first criterion Not observed and submit scorecard
    const notObsBoxes = screen.getAllByLabelText(/Not observed/i);
    await user.click(notObsBoxes[0]);
    expect(screen.getByTestId('observed-average')).toHaveTextContent('1 marked Not observed, excluded from average');

    const overallRadios = screen.getAllByRole('radio', { name: '4' });
    await user.click(overallRadios[overallRadios.length - 1]);
    await user.type(screen.getByLabelText(/Evidence notes/i), 'Passed technical and clinical case review.');
    await user.click(screen.getByRole('button', { name: 'Submit scorecard' }));

    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv-9/scorecard', expect.objectContaining({
      overallRating: 4,
      evaluationTemplate: 'SGH_V1',
      status: 'Submitted',
      criteriaRatings: expect.arrayContaining([
        expect.objectContaining({ criterionKey: 'sgh_communication', notObserved: true, rating: null }),
      ]),
    })));
  });
});
