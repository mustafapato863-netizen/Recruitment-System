import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toast, AlertBanner } from './Toast';

describe('Toast and AlertBanner components', () => {
  it('renders success toast with status role', () => {
    render(<Toast tone="success" title="Candidate Created" message="Candidate added to pipeline." />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Candidate Created');
    expect(toast).toHaveTextContent('Candidate added to pipeline.');
  });

  it('renders error toast with alert role', () => {
    render(<Toast tone="error" title="Submission Failed" message="Please review form errors." />);
    const toast = screen.getByRole('alert');
    expect(toast).toHaveTextContent('Submission Failed');
    expect(toast).toHaveTextContent('Please review form errors.');
  });

  it('renders AlertBanner with accessible tone role', () => {
    render(<AlertBanner tone="warning">Warning: 3 requisitions are approaching SLA.</AlertBanner>);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Warning: 3 requisitions are approaching SLA.');
  });
});
