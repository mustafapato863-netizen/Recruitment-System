import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AtmosphericBackground } from './AtmosphericBackground';

describe('AtmosphericBackground', () => {
  it('exposes the selected variant and pauses while the document is hidden', () => {
    const { container } = render(<AtmosphericBackground variant="dashboard" />);
    const background = container.firstElementChild;
    expect(background).toHaveAttribute('data-variant', 'dashboard');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(background).toHaveAttribute('data-paused', 'true');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
});
