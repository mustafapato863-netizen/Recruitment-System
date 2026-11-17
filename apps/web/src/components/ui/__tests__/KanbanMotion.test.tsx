import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const overlay = vi.hoisted(() => vi.fn());
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return { ...actual, DragOverlay: (props: { dropAnimation: unknown }) => { overlay(props.dropAnimation); return null; } };
});

import { KanbanOverlay } from '../kanban';

afterEach(() => {
  document.documentElement.removeAttribute('data-reduced-motion');
  overlay.mockClear();
  vi.unstubAllGlobals();
});

it('removes the drop animation when the user enables reduced motion and restores it when disabled', async () => {
  document.documentElement.dataset.reducedMotion = 'false';
  render(<KanbanOverlay />);
  expect(overlay.mock.lastCall?.[0]).not.toBeNull();
  act(() => { document.documentElement.dataset.reducedMotion = 'true'; });
  await waitFor(() => expect(overlay.mock.lastCall?.[0]).toBeNull());
  act(() => { document.documentElement.dataset.reducedMotion = 'false'; });
  await waitFor(() => expect(overlay.mock.lastCall?.[0]).not.toBeNull());
});

it('disconnects the preference observer and media listener when the overlay unmounts', () => {
  const disconnect = vi.fn();
  const observe = vi.fn();
  const add = vi.fn();
  const remove = vi.fn();
  vi.stubGlobal('MutationObserver', class {
    observe = observe;
    disconnect = disconnect;
  });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: add, removeEventListener: remove })));
  const { unmount } = render(<KanbanOverlay />);
  expect(observe).toHaveBeenCalledOnce();
  expect(add).toHaveBeenCalledWith('change', expect.any(Function));
  const callback = add.mock.calls[0]![1];
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith('change', callback);
});
