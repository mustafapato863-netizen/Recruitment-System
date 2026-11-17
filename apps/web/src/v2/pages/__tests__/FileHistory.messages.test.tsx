import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

import { MessagesCard, type WhatsAppSendContext } from '../FileHistory';
import type { FileMessages, FileWhatsAppTemplate } from '../../api/applicationFile';

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

  it('keeps saved attempts and retry without an email template composer', async () => {
    const user = userEvent.setup();
    const attempts: Array<Record<string, unknown>> = [{
      id: 'att-1',
      templateId: 'tpl-1',
      templateName: 'Interview invite',
      state: 'Failed',
      reason: 'Mail delivery is disabled. Nothing was sent.',
      at: '2026-10-15T09:00:00.000Z',
      retryOf: null,
    }];
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
      const row = {
        id: 'att-2',
        templateId: 'tpl-1',
        templateName: 'Interview invite',
        state: 'Failed',
        reason: 'Logged locally and nothing was sent.',
        at: '2026-10-15T09:00:00.000Z',
        retryOf: 'att-1',
      };
      attempts.push(row);
      return row;
    });

    render(<MessagesCard applicationId="app-1" followUpDate="2026-10-20" />);
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/Interview invite/)).toBeInTheDocument();
    expect(screen.queryByText(FILLED_SUBJECT)).not.toBeInTheDocument();
    expect(screen.queryByText(FILLED_BODY)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Template')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to local test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mail Templates/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/The candidate is not emailed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SMTP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Coming soon/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry Interview invite' }));
    await waitFor(() => expect(screen.getAllByText('Failed')).toHaveLength(2));
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bSent\b/);
    expect(api.postApi).toHaveBeenCalledTimes(1);
    expect(api.postApi).toHaveBeenCalledWith('/applications/app-1/messages/att-1/retry', {});
    expect(urls.every((url) => url.startsWith('/applications/'))).toBe(true);
    expect(urls.join('\n')).not.toMatch(MAIL_HOST);
  });

  const context: WhatsAppSendContext = {
    phone: '+966 50 123 4567', candidateName: 'Nora Adel', positionTitle: 'Registered Nurse',
    organizationName: 'Saudi German Health', stageName: 'Interview', interviewType: 'Technical',
    interviewDate: '6 Nov 2026', interviewTime: '10:00', recruiterName: 'Mariam Farag',
  };
  const templates: FileWhatsAppTemplate[] = [
    { id: 'admin-ack', name: 'Saved acknowledgement', category: 'ack', isDefault: true, bodyTemplate: 'Application received, {{candidateName}}.' },
    { id: 'admin-invite', name: 'Saved technical invite', category: 'interview_invite', interviewType: 'Technical', bodyTemplate: 'Hello {{candidateName}},\nAdmin invitation for {{positionTitle}} at {{organizationName}}.\n{{interviewDate}} at {{interviewTime}} — {{recruiterName}}' },
    { id: 'admin-offer', name: 'Saved offer follow-up', category: 'offer_next_step', bodyTemplate: 'Hello {{candidateName}}, please contact us about your offer.' },
    { id: 'admin-reject', name: 'Saved rejection', category: 'rejection', bodyTemplate: 'Thank you for applying, {{candidateName}}.' },
    { id: 'admin-reminder', name: 'Saved interview reminder', category: 'interview_invite', interviewType: 'Any', bodyTemplate: 'Interview reminder for {{candidateName}} on {{interviewDate}}.' },
    { id: 'admin-other', name: 'Saved general follow-up', category: 'misc', bodyTemplate: 'General follow-up for {{candidateName}}.' },
  ];
  const payload = (whatsappTemplates: FileWhatsAppTemplate[] | undefined = templates): FileMessages => ({
    followUpDate: null, destination: 'local-test@recruitflow.local', templates: [], attempts: [], whatsappTemplates,
  });
  const card = (data = payload(), sendContext = context, applicationId = 'app-1') => (
    <MessagesCard applicationId={applicationId} followUpDate={null} omitAttempts read={{ status: 'ready', data }} whatsappContext={sendContext} />
  );
  const preview = () => screen.getByRole('region', { name: 'WhatsApp message preview' });

  it('loads saved admin templates and opens exactly the single read-only preview in WhatsApp', async () => {
    api.getApi.mockResolvedValue(payload());
    render(<MessagesCard applicationId="app-1" followUpDate={null} omitAttempts whatsappContext={context} />);
    expect(await screen.findByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-invite');
    expect(screen.getByRole('combobox', { name: 'Message type' })).toHaveValue('interview_invite');
    expect(preview()).toHaveTextContent('Admin invitation for Registered Nurse at Saudi German Health.');
    expect(preview()).toHaveTextContent('6 Nov 2026 at 10:00 — Mariam Farag');
    expect(screen.getAllByRole('region', { name: 'WhatsApp message preview' })).toHaveLength(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /category|variable/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write a WhatsApp|Candidate name|Copy message|Show message preview/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mail Templates|SMTP|local-test@/)).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open in WhatsApp' });
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin + url.pathname).toBe('https://wa.me/966501234567');
    expect(url.searchParams.get('text')).toBe(preview().textContent);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/Review and edit in WhatsApp before sending/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.getApi).toHaveBeenCalledExactlyOnceWith('/applications/app-1/messages');
  });

  it('lets the employee choose a different message type and updates the preview and link together', async () => {
    const user = userEvent.setup();
    render(card());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message type' }), 'offer_next_step');
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-offer');
    expect(screen.queryByRole('option', { name: 'Saved technical invite' })).not.toBeInTheDocument();
    expect(preview()).toHaveTextContent('Hello Nora Adel, please contact us about your offer.');
    const url = new URL(screen.getByRole('link', { name: 'Open in WhatsApp' }).getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe(preview().textContent);
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('shows every available admin message type and lets the employee pick a template within the type', async () => {
    const user = userEvent.setup();
    render(card());
    const type = screen.getByRole('combobox', { name: 'Message type' });
    expect(Array.from(type.querySelectorAll('option'), (option) => option.textContent)).toEqual([
      'Application acknowledgement', 'Interview invitation', 'Offer / next steps', 'Rejection', 'Other',
    ]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'WhatsApp template' }), 'admin-reminder');
    expect(preview()).toHaveTextContent('Interview reminder for Nora Adel on 6 Nov 2026.');
    await user.selectOptions(type, 'misc');
    expect(preview()).toHaveTextContent('General follow-up for Nora Adel.');
    await user.selectOptions(type, 'interview_invite');
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-invite');
    expect(preview()).toHaveTextContent('Admin invitation');
  });

  it('offers only types with active saved templates and retains the chosen type when one template is archived', async () => {
    const user = userEvent.setup();
    const { rerender } = render(card(payload(templates.filter((template) => template.category === 'interview_invite'))));
    const type = screen.getByRole('combobox', { name: 'Message type' });
    expect(type.querySelectorAll('option')).toHaveLength(1);
    expect(screen.queryByRole('option', { name: 'Rejection' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'WhatsApp template' }), 'admin-reminder');
    rerender(card(payload(templates.filter((template) => template.id !== 'admin-reminder'))));
    expect(type).toHaveValue('interview_invite');
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-invite');
  });

  it('keeps an explicitly chosen type when its selected template is replaced, regardless of application stage', async () => {
    const user = userEvent.setup();
    const secondOffer = { ...templates[2], id: 'second-offer', name: 'Another saved offer' };
    const { rerender } = render(card(payload([...templates, secondOffer])));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message type' }), 'offer_next_step');
    await user.selectOptions(screen.getByRole('combobox', { name: 'WhatsApp template' }), 'second-offer');
    rerender(card(payload()));
    expect(screen.getByRole('combobox', { name: 'Message type' })).toHaveValue('offer_next_step');
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-offer');
    expect(preview()).toHaveTextContent('please contact us about your offer.');
  });

  it.each([
    ['Applied', 'admin-ack'], ['Screening', 'admin-invite'], ['Offer', 'admin-offer'],
    ['Pre-hire', 'admin-offer'], ['Rejected', 'admin-reject'],
  ])('suggests the saved template for the %s stage', (stageName, expectedId) => {
    render(card(payload(), { ...context, stageName }));
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue(expectedId);
  });

  it('uses current candidate details and refreshed admin copy without keeping a stale draft or phone', () => {
    const { rerender } = render(card());
    const updated = templates.map((template) => template.id === 'admin-invite'
      ? { ...template, bodyTemplate: 'Admin revised copy: {{candidateName}}, {{positionTitle}}.' } : template);
    rerender(card(payload(updated), { ...context, candidateName: 'Updated Candidate', phone: '+20 100 000 0000' }));
    expect(preview()).toHaveTextContent('Admin revised copy: Updated Candidate, Registered Nurse.');
    const url = new URL(screen.getByRole('link', { name: 'Open in WhatsApp' }).getAttribute('href')!);
    expect(url.pathname).toBe('/201000000000');
    expect(url.searchParams.get('text')).toBe(preview().textContent);
  });

  it('drops an archived selection after refresh and resets the selection for another application', async () => {
    const user = userEvent.setup();
    const { rerender } = render(card());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message type' }), 'offer_next_step');
    rerender(card(payload(templates.filter((template) => template.id !== 'admin-offer'))));
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-invite');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message type' }), 'ack');
    rerender(card(payload(), context, 'app-2'));
    expect(screen.getByRole('combobox', { name: 'WhatsApp template' })).toHaveValue('admin-invite');
  });

  it.each([[], undefined])('does not invent frontend templates when saved templates are %s', (saved) => {
    render(card({ ...payload(), whatsappTemplates: saved }));
    expect(screen.getByRole('status')).toHaveTextContent(/admin/i);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in WhatsApp' })).not.toBeInTheDocument();
  });

  it.each(['', '0501234567', '123', '+966501234567 ext 3', '+1234567890123456'])('prevents opening WhatsApp with invalid phone %s', (phone) => {
    render(card(payload(), { ...context, phone }));
    expect(screen.getByRole('button', { name: 'Open in WhatsApp' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Open in WhatsApp' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('candidate profile');
  });

  it.each(['{{interviewDate}}', '{{interviewTime}}', '{{unknownAdminVariable}}', '{{toString}}'])('blocks unresolved required template data %s and recovers when available', (bodyTemplate) => {
    const data = payload([{ ...templates[1], bodyTemplate }]);
    const { rerender } = render(card(data, { ...context, interviewDate: '', interviewTime: ' ' }));
    expect(screen.getByRole('button', { name: 'Open in WhatsApp' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('missing details');
    rerender(card(payload()));
    expect(screen.getByRole('link', { name: 'Open in WhatsApp' })).toBeInTheDocument();
  });

  it('does not open an empty template', () => {
    render(card(payload([{ ...templates[1], bodyTemplate: '  ' }])));
    expect(screen.getByRole('button', { name: 'Open in WhatsApp' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('template is empty');
  });

});
