import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RedactedJobsSection } from '../RedactedJobs';
import { RedactedJobDetail } from '../RedactedJobDetail';
import { RedactedJobOptions, RedactedJobPickerRows } from '../RedactedJobOptions';
import { ForbiddenState } from '../ForbiddenState';
import { redactedJob, redactedJobSparse } from '../../../test/fixtures/b1';
import { MemoryRouter } from 'react-router-dom';

describe('B1 redacted job rendering', () => {
  it('shows title, site and seats only, marked, with no actions or links', () => {
    render(<RedactedJobsSection jobs={[redactedJob, redactedJobSparse]} />);
    const section = screen.getByRole('region', { name: "Other recruiters' jobs" });
    expect(within(section).getByText('Staff Nurse – ER')).toBeInTheDocument();
    expect(within(section).getByText('SGH Jeddah')).toBeInTheDocument();
    expect(within(section).getByText('2 of 5 seats filled')).toBeInTheDocument();
    expect(within(section).getAllByText('Owned by another recruiter')).toHaveLength(2);
    expect(within(section).getByText('Untitled job')).toBeInTheDocument();
    expect(within(section).queryAllByRole('button')).toHaveLength(0);
    expect(within(section).queryAllByRole('link')).toHaveLength(0);
  });

  it('renders nothing when there are no redacted jobs', () => {
    const { container } = render(<RedactedJobsSection jobs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('detail view is read-only with only a back action', () => {
    render(<RedactedJobDetail job={redactedJob} onBack={() => {}} />);
    expect(screen.getByText('Staff Nurse – ER')).toBeInTheDocument();
    expect(screen.getByText(/Owned by another recruiter/)).toBeInTheDocument();
    expect(screen.getByText('2 of 5 filled')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to Job Positions']);
  });

  it('native picker options are disabled with the reason and cannot be chosen', async () => {
    const user = userEvent.setup();
    render(
      <select aria-label="Job" defaultValue="vac-1">
        <option value="vac-1">ICU Nurse</option>
        <RedactedJobOptions jobs={[redactedJob]} />
      </select>,
    );
    const opt = screen.getByRole('option', { name: /Staff Nurse – ER · SGH Jeddah \(owned by another recruiter\)/ });
    expect(opt).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Job'), opt).catch(() => {});
    expect(screen.getByLabelText('Job')).toHaveValue('vac-1');
  });

  it('card picker rows are aria-disabled and not interactive', () => {
    render(<RedactedJobPickerRows jobs={[redactedJob]} />);
    const row = screen.getByText('Staff Nurse – ER').closest('li')!;
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
  });

  it('ForbiddenState uses v1 PageState forbidden copy', () => {
    render(<MemoryRouter><ForbiddenState title="You do not have access to this application" /></MemoryRouter>);
    expect(screen.getByText('You do not have access to this application')).toBeInTheDocument();
    expect(screen.getByText(/belongs to another owner/)).toBeInTheDocument();
  });
});
