import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmailTemplatesPage } from '../EmailTemplatesPage';

// ─── Mocks ────────────────────────────────────────────────────────
vi.mock('../../api/client', () => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  deleteApi: vi.fn(),
}));

import { getApi, postApi } from '../../api/client';

const mockTemplates = [
  {
    id: 'tpl-1',
    organizationId: 'org-1',
    name: 'Application Received — Acknowledgement',
    category: 'stage_auto',
    subject: 'We received your application for {{positionTitle}}',
    bodyTemplate: 'Dear {{candidateName}}, thank you for applying.',
    isDefault: true,
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tpl-2',
    organizationId: 'org-1',
    name: 'Custom Follow-up',
    category: 'stage_auto',
    subject: 'Following up on your application',
    bodyTemplate: 'Dear {{candidateName}}, we wanted to follow up.',
    isDefault: false,
    status: 'Active',
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

// ─── Tests ────────────────────────────────────────────────────────
describe('EmailTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApi).mockResolvedValue(mockTemplates);
    vi.mocked(postApi).mockResolvedValue(mockTemplates[1]);
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <EmailTemplatesPage />
      </MemoryRouter>,
    );
  }

  it('renders the list of email templates', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Application Received — Acknowledgement')).toBeInTheDocument();
    });
    expect(screen.getByText('Custom Follow-up')).toBeInTheDocument();
  });

  it('shows Default badge on default templates and hides edit/delete buttons', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
    // Default template (tpl-1) must NOT have edit/delete buttons
    expect(document.getElementById('btn-edit-tpl-1')).toBeNull();
    expect(document.getElementById('btn-delete-tpl-1')).toBeNull();
    // Custom template (tpl-2) SHOULD have edit/delete buttons
    expect(document.getElementById('btn-edit-tpl-2')).not.toBeNull();
    expect(document.getElementById('btn-delete-tpl-2')).not.toBeNull();
  });

  it('opens create modal and submits a new template', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Application Received — Acknowledgement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'My New Template' } });
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Hello {{candidateName}}' } });
    fireEvent.change(screen.getByLabelText(/body/i), { target: { value: 'Dear {{candidateName}},\nWelcome!' } });

    fireEvent.click(screen.getByRole('button', { name: /create template/i }));

    await waitFor(() => {
      expect(postApi).toHaveBeenCalledWith('/email-templates', expect.objectContaining({
        name: 'My New Template',
        subject: 'Hello {{candidateName}}',
      }));
    });
  });
});
