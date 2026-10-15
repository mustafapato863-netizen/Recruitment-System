import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

import { MessagesCard } from '../FileHistory';

const FILLED_SUBJECT = 'Hello Phase6 Sample for Registered Nurse on 20 Oct 2026';
const FILLED_BODY = 'Dear Phase6 Sample, the interview is on 20 Oct 2026.';
const MAIL_HOST = /sendgrid|mailgun|smtp\.|gmail\.com|yahoo\.com|outlook\.com|amazonses|postmark|resend\.com|graph\.microsoft/i;

describe('MessagesCard local test', () => {
  const urls: string[] = [];

  beforeEach(() => {
    urls.length = 0;
    api.getApi.mockReset();
    api.postApi.mockReset();
  });

  it('shows the filled subject before the local test and does not say Sent', async () => {
    const user = userEvent.setup();
    const attempts: Array<Record<string, unknown>> = [];
    const payload = () => ({
      followUpDate: '2026-10-20',
      destination: 'local-test@recruitflow.local',
      templates: [{ id: 'tpl-1', name: 'Interview invite', subject: FILLED_SUBJECT, body: FILLED_BODY }],
      attempts: attempts.map((row) => ({ ...row })),
    });
    api.getApi.mockImplementation(async (path: string) => {
      urls.push(path);
      return payload();
    });
    api.postApi.mockImplementation(async (path: string) => {
      urls.push(path);
      const retry = path.includes('/retry');
      const row = {
        id: retry ? 'att-2' : 'att-1',
        templateId: 'tpl-1',
        templateName: 'Interview invite',
        state: 'Failed',
        reason: retry ? 'Logged locally and nothing was sent.' : 'Mail delivery is disabled. Nothing was sent.',
        at: '2026-10-15T09:00:00.000Z',
        retryOf: retry ? 'att-1' : null,
      };
      attempts.push(row);
      return row;
    });

    render(<MessagesCard applicationId="app-1" followUpDate="2026-10-20" />);
    expect(await screen.findByText(/local-test@recruitflow.local/)).toBeInTheDocument();
    expect(screen.getByText(/The candidate is not emailed/)).toBeInTheDocument();
    expect(screen.queryByText(FILLED_SUBJECT)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Template'), 'tpl-1');
    const subject = screen.getByText(FILLED_SUBJECT);
    const body = screen.getByText(FILLED_BODY);
    const action = screen.getByRole('button', { name: 'Send to local test' });
    expect(subject.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(action);
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bSent\b/);

    await user.click(screen.getByRole('button', { name: 'Retry Interview invite' }));
    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(2));
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bSent\b/);
    expect(api.postApi).toHaveBeenNthCalledWith(1, '/applications/app-1/messages', { templateId: 'tpl-1' });
    expect(api.postApi).toHaveBeenNthCalledWith(2, '/applications/app-1/messages/att-1/retry', {});
    expect(urls.every((url) => url.startsWith('/applications/'))).toBe(true);
    expect(urls.join('\n')).not.toMatch(MAIL_HOST);
  });
});
