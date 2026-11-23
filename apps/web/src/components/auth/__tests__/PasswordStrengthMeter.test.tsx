import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';

describe('PasswordStrengthMeter', () => {
  it('shows every rule as not met for a weak password and names the strength in text', () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Password strength: Weak/);
    expect(screen.getByRole('status')).toHaveTextContent(/2 of 6 requirements met/);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '1');
    for (const label of ['At least 10 characters', 'upper-case', 'lower-case', 'number', 'symbol']) {
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    }
    expect(screen.getAllByText('Not met').length).toBeGreaterThan(0);
  });

  it('shows Strong with all rules met at the 10-character boundary', () => {
    render(<PasswordStrengthMeter password="Ab1!defghi" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Password strength: Strong/);
    expect(screen.getByRole('status')).toHaveTextContent(/6 of 6 requirements met/);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '4');
    expect(screen.queryByText('Not met')).toBeNull();
  });

  it('adds the email rule when an email is given and hides the checklist when asked', () => {
    const { rerender } = render(<PasswordStrengthMeter password="Sarah.ahmed1!" email="sarah.ahmed@recruitflow.local" />);
    expect(screen.getByText('Does not contain your email name')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/6 of 7 requirements met/);
    rerender(<PasswordStrengthMeter password="Ab1!defghi" showChecklist={false} />);
    expect(screen.queryByLabelText('Password requirements')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/Password strength: Strong/);
  });

  it('prompts for input when the password is empty', () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Enter a password/);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });
});
