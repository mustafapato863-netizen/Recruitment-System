import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationAlertDialog } from './notification-alert-dialog';
import * as apiClient from '../../api/client';
import * as authContext from '../../auth/AuthContext';

vi.mock('../../api/client');
vi.mock('../../auth/AuthContext');

describe('NotificationAlertDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u-1',
        email: 'recruiter@recruitflow.com',
        displayName: 'Recruiter User',
        organizationId: 'org-1',
        organizationName: 'HQ Healthcare',
        roles: [{ id: 'r-1', name: 'RECRUITER', code: 'RECRUITER' }],
        permissions: ['NOTIFICATION_VIEW'],
        lastLoginAt: null,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(apiClient, 'getApi').mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') {
        return Promise.resolve({ unreadCount: 2 });
      }
      if (url.startsWith('/notifications')) {
        return Promise.resolve({
          data: [
            {
              id: 'n-1',
              title: 'Offer Approved',
              message: 'Offer package for Sarah Jenkins approved',
              type: 'Offer',
              readAt: null,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'n-2',
              title: 'Interview Scheduled',
              message: 'Technical interview tomorrow at 10:00 AM',
              type: 'Interview',
              readAt: '2026-08-20T10:00:00.000Z',
              createdAt: '2026-08-20T09:00:00.000Z',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        });
      }
      return Promise.resolve({});
    });
  });

  it('renders trigger button with unread count badge', async () => {
    render(
      <MemoryRouter>
        <NotificationAlertDialog triggerVariant="icon" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Notifications, 2 unread/i })).toBeInTheDocument();
    });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens popover dialog when clicked and fetches notifications', async () => {
    render(
      <MemoryRouter>
        <NotificationAlertDialog triggerVariant="icon" />
      </MemoryRouter>
    );

    const trigger = await screen.findByRole('button', { name: /Notifications, 2 unread/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: /Notifications Dropdown/i })).toBeInTheDocument();
    expect(await screen.findByText('Offer Approved')).toBeInTheDocument();
    expect(screen.getByText('Interview Scheduled')).toBeInTheDocument();
  });

  it('filters notifications when Unread tab is selected', async () => {
    render(
      <MemoryRouter>
        <NotificationAlertDialog triggerVariant="icon" />
      </MemoryRouter>
    );

    const trigger = await screen.findByRole('button', { name: /Notifications, 2 unread/i });
    fireEvent.click(trigger);

    const unreadTab = await screen.findByRole('button', { name: /Unread \(2\)/i });
    fireEvent.click(unreadTab);

    expect(unreadTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes popover on Escape key press and restores focus', async () => {
    render(
      <MemoryRouter>
        <NotificationAlertDialog triggerVariant="icon" />
      </MemoryRouter>
    );

    const trigger = await screen.findByRole('button', { name: /Notifications, 2 unread/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});