import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDocumentMeta } from '../useDocumentMeta';

function MetaProbe({ title, description }: { title?: string; description?: string }) {
  useDocumentMeta(title, description);
  return null;
}

describe('useDocumentMeta', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('updates document.title and meta description and restores them on unmount', () => {
    document.title = 'Initial Title';
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = 'Initial Description';
    document.head.appendChild(meta);

    const { unmount } = render(
      <MetaProbe title="Open Roles • SGH" description="Browse open positions at SGH." />,
    );

    expect(document.title).toBe('Open Roles • SGH');
    expect(meta.getAttribute('content')).toBe('Browse open positions at SGH.');

    unmount();

    expect(document.title).toBe('Initial Title');
    expect(meta.getAttribute('content')).toBe('Initial Description');
  });
});
