import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';
import { Input } from './Input';

describe('FormField', () => {
  it('connects a native control to hint text without replacing existing semantics', () => {
    render(
      <FormField id="candidate-name" label="Candidate name" hint="Use the legal name shown on the CV.">
        <Input />
      </FormField>,
    );

    const input = screen.getByLabelText('Candidate name');
    expect(input).toHaveAttribute('id', 'candidate-name');
    expect(input).toHaveAttribute('aria-describedby', 'candidate-name-message');
    expect(screen.getByText('Use the legal name shown on the CV.').closest('p')).toHaveAttribute('id', 'candidate-name-message');
  });

  it('marks a control invalid and announces the inline error', () => {
    render(
      <FormField id="candidate-email" label="Email" error="Enter a valid email address.">
        <Input type="email" />
      </FormField>,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  });

  it('does not assign a field ID to a non-control wrapper', () => {
    render(
      <FormField id="wrapped-email" label="Email address">
        <div className="relative"><Input id="wrapped-email" type="email" /></div>
      </FormField>,
    );

    expect(screen.getByLabelText('Email address')).toHaveAttribute('id', 'wrapped-email');
    expect(document.querySelectorAll('#wrapped-email')).toHaveLength(1);
  });
});
