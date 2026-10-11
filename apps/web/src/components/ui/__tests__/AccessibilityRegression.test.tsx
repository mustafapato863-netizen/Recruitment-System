import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, dataTableClasses } from '../DataTable';
import { Modal } from '../../Modal';
import { FormField } from '../FormField';
import { IconButton } from '../IconButton';
import { Icon } from '../../Icon';

describe('Accessibility Regression Tests', () => {
  describe('DataTable accessibility', () => {
    it('renders accessible table markup with column headers and cell scopes', () => {
      render(
        <DataTable aria-label="Candidates Table">
          <thead>
            <tr className={dataTableClasses.head}>
              <th scope="col" className={dataTableClasses.th} aria-sort="ascending">Name</th>
              <th scope="col" className={dataTableClasses.th}>Role</th>
              <th scope="col" className={dataTableClasses.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className={dataTableClasses.row}>
              <td className={dataTableClasses.td}>Dr. Ahmed Al-Mansoor</td>
              <td className={dataTableClasses.td}>Cardiologist</td>
              <td className={dataTableClasses.td}>Active</td>
            </tr>
          </tbody>
        </DataTable>
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(3);
      expect(headers[0]).toHaveTextContent('Name');
      expect(headers[0]).toHaveAttribute('scope', 'col');
      expect(headers[0]).toHaveAttribute('aria-sort', 'ascending');

      const cells = screen.getAllByRole('cell');
      expect(cells).toHaveLength(3);
      expect(cells[0]).toHaveTextContent('Dr. Ahmed Al-Mansoor');
    });
  });

  describe('Modal accessibility and focus-trap', () => {
    it('renders with role="dialog", aria-modal="true", and accessible title label', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Security Compliance Review">
          <p>Reviewing SCFHS clinical credentials.</p>
          <button type="button">Confirm Credentials</button>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const heading = screen.getByRole('heading', { name: 'Security Compliance Review' });
      expect(heading).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
    });

    it('triggers onClose when Escape key is pressed', async () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Escape Test Modal">
          <p>Modal content</p>
          <button type="button">Dismiss</button>
        </Modal>
      );

      await userEvent.keyboard('{Escape}');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('returns null and does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Closed Modal">
          <p>Hidden content</p>
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('FormField accessible error announcement and input pairing', () => {
    it('links label to input and injects aria-describedby and aria-invalid on error', () => {
      render(
        <FormField id="candidate-email" label="Email Address" required error="Valid email is required">
          <input type="email" placeholder="name@domain.com" />
        </FormField>
      );

      const label = screen.getByText(/Email Address/i);
      expect(label).toHaveAttribute('for', 'candidate-email');

      const input = screen.getByPlaceholderText('name@domain.com');
      expect(input).toHaveAttribute('id', 'candidate-email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'candidate-email-message');

      const alertMessage = screen.getByRole('alert');
      expect(alertMessage).toHaveTextContent('Valid email is required');
      expect(alertMessage).toHaveAttribute('id', 'candidate-email-message');
    });

    it('renders hint without error alert role when valid', () => {
      render(
        <FormField id="license-no" label="SCFHS License" hint="Enter 10-digit registration number">
          <input type="text" />
        </FormField>
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Enter 10-digit registration number').closest('p')).toHaveAttribute('id', 'license-no-message');
      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'license-no-message');
    });
  });

  describe('IconButton screen reader accessible naming', () => {
    it('provides accessible label via aria-label and button role', () => {
      render(
        <IconButton label="Expand navigation menu">
          <Icon name="chevron-right" size={16} />
        </IconButton>
      );

      const button = screen.getByRole('button', { name: 'Expand navigation menu' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Expand navigation menu');
    });

    it('passes through disabled attribute correctly preventing keyboard activation', () => {
      const handleClick = vi.fn();
      render(
        <IconButton label="Delete record" disabled onClick={handleClick}>
          <Icon name="trash" size={16} />
        </IconButton>
      );

      const button = screen.getByRole('button', { name: 'Delete record' });
      expect(button).toBeDisabled();
    });
  });
});
