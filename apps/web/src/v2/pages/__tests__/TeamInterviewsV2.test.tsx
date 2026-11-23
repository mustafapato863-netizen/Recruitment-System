import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
const calendarDownload = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../api/myInterviews', async () => ({ ...(await vi.importActual<object>('../../../api/myInterviews')), ...calendarDownload }));
import { TeamInterviewsV2 } from '../TeamInterviewsV2';

const interview = (extra: Record<string, unknown> = {}) => ({
  id: 'i1', title: 'Screen', interviewType: 'Screening', scheduledStart: '2099-06-01T09:00:00.000Z', scheduledEnd: '2099-06-01T09:30:00.000Z',
  timezone: null, candidateName: 'Lina Hassan', positionTitle: 'Ward Nurse', locationUrl: null, roomName: null,
  myResponse: 'Pending', scorecardStatus: 'missing', status: 'Scheduled', ...extra,
});

const renderAt = (path = '/team-interviews') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><TeamInterviewsV2 /></MemoryRouter>);
};

beforeEach(() => { vi.clearAllMocks(); calendarDownload.downloadIcs.mockResolvedValue('interview.ics'); });

describe('Manager interviews', () => {
  it('a failed read is an error, not an empty interview list', async () => {
    api.getApi.mockRejectedValue(new ApiError(500, 'Interviews down'));
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Interviews down');
    expect(screen.queryByText(/That is an empty list/)).toBeNull();
  });

  it('shows the saved interview in Africa/Cairo and does not invent a time zone', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/me/interviews?scope=upcoming') return { data: [interview()] };
      if (path.startsWith('/me/interviews')) return { data: [] };
      if (path === '/interviews') return { data: [{ id: 'i9', scheduledStart: '2099-06-02T10:00:00.000Z', scheduledEnd: '2099-06-02T10:30:00.000Z', candidateName: 'Rana Adel', positionTitle: 'BI Analyst', status: 'Scheduled', applicationId: 'a9' }] };
      throw new ApiError(404, 'nf');
    });
    const u = userEvent.setup();
    renderAt();
    const table = await screen.findByRole('table', { name: 'Interviews' });
    expect(table).toHaveTextContent('Lina Hassan');
    expect(table).toHaveTextContent('Not recorded');
    expect(screen.getByRole('link', { name: 'Open my scorecard' })).toHaveAttribute('href', '/my-interviews?interview=i1&scorecard=1');
    await u.click(screen.getByRole('button', { name: 'Download calendar' }));
    expect(calendarDownload.downloadIcs).toHaveBeenCalledWith('i1');
    await u.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByText(/Lina Hassan/)).toBeInTheDocument();
    expect(screen.getByText(/Time zone not recorded/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Team interviews' }));
    expect(await screen.findByRole('link', { name: 'Open file' })).toHaveAttribute('href', '/applications/a9');
    expect(screen.getByText('Rana Adel')).toBeInTheDocument();
  });

  it('reports an ICS download permission failure without hiding the interview', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/me/interviews?scope=upcoming') return { data: [interview()] };
      if (path === '/me/interviews?scope=past') return { data: [] };
      if (path === '/interviews') return { data: [] };
      throw new ApiError(404, 'nf');
    });
    calendarDownload.downloadIcs.mockRejectedValue(new ApiError(403, 'Not authorized'));
    renderAt();
    const u = userEvent.setup();
    await screen.findByRole('table', { name: 'Interviews' });
    await u.click(screen.getByRole('button', { name: 'Download calendar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("You can't download this calendar file");
    expect(screen.getByText('Lina Hassan')).toBeInTheDocument();
  });

  it('a forbidden team list is access denied, and a server error is not zero interviews', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/me/interviews')) return { data: [] };
      throw new ApiError(403, 'no');
    });
    const u = userEvent.setup();
    renderAt();
    expect(await screen.findByText(/That is an empty list/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Team interviews' }));
    expect(await screen.findByText('You cannot open the team interview list.')).toBeInTheDocument();
    expect(screen.queryByText(/That is an empty list/)).toBeNull();
  });

  it('routes past-due Scheduled team interviews into Needs feedback and lets empty mine view switch to Team interviews', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/me/interviews')) return { data: [] };
      if (path === '/interviews') {
        return {
          data: [
            { id: 'i-past', scheduledStart: '2020-01-01T09:00:00.000Z', scheduledEnd: '2020-01-01T09:30:00.000Z', candidateName: 'Omar Tariq', positionTitle: 'Charge Nurse', status: 'Scheduled', applicationId: 'a-past' },
            { id: 'i-done', scheduledStart: '2020-01-02T09:00:00.000Z', scheduledEnd: '2020-01-02T09:30:00.000Z', candidateName: 'Dina Adel', positionTitle: 'ICU Nurse', status: 'Completed', applicationId: 'a-done' },
          ],
        };
      }
      throw new ApiError(404, 'nf');
    });
    const u = userEvent.setup();
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'View Team interviews' }));
    await u.click(screen.getByRole('tab', { name: /Needs feedback/ }));
    expect(await screen.findByText('Omar Tariq')).toBeInTheDocument();
    expect(screen.queryByText('Dina Adel')).toBeNull();
    await u.click(screen.getByRole('tab', { name: /Completed/ }));
    expect(await screen.findByText('Dina Adel')).toBeInTheDocument();
    expect(screen.queryByText('Omar Tariq')).toBeNull();
  });

  it('renders Microsoft Outlook-style calendar with Month, Week views, navigation and filters', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/me/interviews?scope=upcoming') {
        return {
          data: [
            interview({ id: 'i1', candidateName: 'Lina Hassan', positionTitle: 'Ward Nurse', scheduledStart: '2099-06-01T09:00:00.000Z', scheduledEnd: '2099-06-01T09:30:00.000Z' }),
            interview({ id: 'i2', candidateName: 'Amr Khaled', positionTitle: 'Cardiologist', scheduledStart: '2099-06-15T14:00:00.000Z', scheduledEnd: '2099-06-15T15:00:00.000Z' }),
          ],
        };
      }
      if (path.startsWith('/me/interviews')) return { data: [] };
      if (path === '/interviews') return { data: [] };
      throw new ApiError(404, 'nf');
    });
    const u = userEvent.setup();
    renderAt('/team-interviews?view=calendar');

    // Calendar is rendered with Microsoft Outlook grid
    expect(await screen.findByRole('grid', { name: 'Month view' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /June 2099/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sun' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mon' })).toBeInTheDocument();

    // Day inspector displays candidate and details
    expect(screen.getByText('Lina Hassan')).toBeInTheDocument();
    expect(screen.getAllByText('Ward Nurse').length).toBeGreaterThanOrEqual(1);

    // Switch to Week view
    await u.click(screen.getByRole('button', { name: 'Week' }));
    expect(await screen.findByRole('grid', { name: 'Week view' })).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();

    // Switch back to Month view
    await u.click(screen.getByRole('button', { name: 'Month' }));
    expect(await screen.findByRole('grid', { name: 'Month view' })).toBeInTheDocument();

    // Navigation: Next month
    await u.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { level: 2, name: /July 2099/ })).toBeInTheDocument();

    // Navigation: Today
    await u.click(screen.getByRole('button', { name: 'Today' }));
    const currentYear = String(new Date().getFullYear());
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(currentYear) })).toBeInTheDocument();

    // Filter pills
    await u.click(screen.getByRole('button', { name: /Completed/ }));
    expect(screen.getByRole('grid', { name: 'Month view' })).toBeInTheDocument();
  });
});
