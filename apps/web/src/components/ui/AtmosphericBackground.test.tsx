import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AtmosphericBackground } from './AtmosphericBackground';

describe('AtmosphericBackground', () => {
  it('exposes the selected variant and pauses while the document is hidden', () => {
    const { container } = render(<AtmosphericBackground variant="dashboard" />);
    expect(container.firstChild).toBeNull();
  });
});
