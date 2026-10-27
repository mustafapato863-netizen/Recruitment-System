import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));

import { NotificationsPage } from '../NotificationsPage';

const SUBTITLE = 'Stay updated with cross-system alerts, approvals, and workflow events';

const unread: NotificationRecord = {
  id: 'n1',
  organizationId: 'org-1',
  recipientUserId: 'u1',
  type: 'ApplicationUpdated',
  title: 'Screen Nour Ali',
  message: 'A file is waiting on your decision.',
  entityType: 'Application',
  entityId: '20000000-0000-4000-8000-000000000510',
  readAt: null,
  createdAt: '2026-10-27T08:00:00.000Z',
  applicationId: '20000000-0000-4000-8000-000000000510',
};

function pageOf(rows: NotificationRecord[], total = rows.length): PaginatedResult<NotificationRecord> {
  return { data: rows, total, page: 1, pageSize: 20 };
}

function mockFeed(rows: NotificationRecord[], unreadCount: number) {
  api.getApi.mockImplementation(async (url: string) => {
    if (url.startsWith('/notifications/unread-count')) return { unreadCount };
    if (url.includes('unreadOnly=true')) return pageOf(rows.filter((row) => !row.readAt));
    return pageOf(rows);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

describe('Notification Center desk', () => {
  beforeEach(() => {
    api.getApi.mockReset();
    api.patchApi.mockReset();
    api.postApi.mockReset();
  });

  it('lets the subtitle lead and keeps the filters, refresh, and notification actions', async () => {
    mockFeed([unread], 1);
    renderPage();

    const lead = await screen.findByText(SUBTITLE);
    const filters = screen.getByRole('tablist', { name: 'Notification filters' });
    expect(lead.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Notification Center' })).not.toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /All Notifications/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Unread Only/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /System Alerts/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pending Approvals/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh notifications' })).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Screen Nour Ali' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open details/ })).toHaveAttribute('href', '/applications/20000000-0000-4000-8000-000000000510');
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark all as read/ })).toBeInTheDocument();
  });

  it('keeps the empty sentences when a view has no rows', async () => {
    const user = userEvent.setup();
    mockFeed([], 0);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'No notifications in this view' })).toBeInTheDocument();
    expect(screen.getByText('New approvals, system alerts, and workflow events will appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notification Center' })).not.toBeInTheDocument();
    expect(screen.getByText(SUBTITLE).compareDocumentPosition(screen.getByRole('tablist', { name: 'Notification filters' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /Unread Only/ }));

    expect(await screen.findByRole('heading', { name: 'You’re all caught up!' })).toBeInTheDocument();
    expect(screen.getByText('There are no unread updates waiting for your review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all notifications' })).toBeInTheDocument();
  });
});
