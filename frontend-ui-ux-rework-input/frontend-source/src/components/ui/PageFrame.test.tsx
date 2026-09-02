import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PageFrame } from './PageFrame';

describe('PageFrame component', () => {
  it('renders title, eyebrow, and description', () => {
    render(
      <PageFrame
        eyebrow="Recruitment Operations"
        title="Openings & Job Cards"
        description="Manage active requisitions and vacancies across all branches."
      >
        <div>Content Body</div>
      </PageFrame>
    );

    expect(screen.getByText('Recruitment Operations')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Openings & Job Cards' })).toBeVisible();
    expect(screen.getByText('Manage active requisitions and vacancies across all branches.')).toBeVisible();
    expect(screen.getByText('Content Body')).toBeVisible();
  });

  it('renders actions and back button when configured', () => {
    render(
      <BrowserRouter>
        <PageFrame
          title="Vacancy Detail"
          showBack={true}
          backTo="/vacancies"
          actions={<button type="button">Edit Vacancy</button>}
        >
          <div>Vacancy Details Content</div>
        </PageFrame>
      </BrowserRouter>
    );

    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/vacancies');
    expect(screen.getByRole('button', { name: 'Edit Vacancy' })).toBeVisible();
  });
});
