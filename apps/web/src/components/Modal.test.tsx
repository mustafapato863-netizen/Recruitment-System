import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from './Modal';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Decision dialog">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>
    </>
  );
}

function RerenderingModalHarness() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open editor</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Editor dialog">
        <label htmlFor="modal-editor-input">Role code</label>
        <input id="modal-editor-input" value={value} onChange={(event) => setValue(event.target.value)} />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('moves focus inside, closes with Escape, and returns focus', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('keeps focus in an input when the parent rerenders while typing', async () => {
    const user = userEvent.setup();
    render(<RerenderingModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    const input = screen.getByRole('textbox', { name: 'Role code' });
    await user.click(input);
    await user.type(input, 'QA_ROLE');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('QA_ROLE');
  });
});
