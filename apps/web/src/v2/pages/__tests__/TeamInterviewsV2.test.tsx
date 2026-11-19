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
});
