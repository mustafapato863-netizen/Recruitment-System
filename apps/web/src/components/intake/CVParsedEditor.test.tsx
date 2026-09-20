import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CVParsedEditor } from './CVParsedEditor';
import type { ExtractedCandidate } from '../../utils/resumeParser';

const baseProfile: ExtractedCandidate = {
  firstName: 'Omar',
  lastName: 'Hassan',
  email: 'omar.hassan@example.com',
  title: 'Senior Software Engineer',
  experienceYears: 8,
  skills: ['React', 'TypeScript', 'Node.js'],
};

describe('CVParsedEditor Parser Badges', () => {
  it('renders Affinda Engine badge with quality indicator when parserSource is affinda', () => {
    render(
      <CVParsedEditor
        profile={{
          ...baseProfile,
          parserSource: 'affinda',
          parsingQuality: 'high',
        }}
        setProfile={vi.fn()}
        uploadedFileName="Omar_Hassan_Resume.pdf"
        candidateSource="CV Intake Upload"
        candidateSourceOptions={['CV Intake Upload']}
        setCandidateSource={vi.fn()}
        onReset={vi.fn()}
        onBack={vi.fn()}
        onProceed={vi.fn()}
      />,
    );

    const badge = screen.getByTestId('parser-source-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Affinda Engine');
    expect(badge).toHaveTextContent('HIGH Quality');
  });

  it('renders Legacy Fallback badge when parserSource is legacy', () => {
    render(
      <CVParsedEditor
        profile={{
          ...baseProfile,
          parserSource: 'legacy',
          parsingQuality: 'medium',
        }}
        setProfile={vi.fn()}
        uploadedFileName="Omar_Hassan_Resume.pdf"
        candidateSource="CV Intake Upload"
        candidateSourceOptions={['CV Intake Upload']}
        setCandidateSource={vi.fn()}
        onReset={vi.fn()}
        onBack={vi.fn()}
        onProceed={vi.fn()}
      />,
    );

    const badge = screen.getByTestId('parser-source-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Legacy Fallback');
    expect(badge).toHaveTextContent('MEDIUM Quality');
  });
});
