import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CVMatchAssigner } from './CVMatchAssigner';
import type { DuplicateCandidate } from '../../hooks/useCVIntakeFlow';
import type { ExtractedCandidate } from '../../utils/resumeParser';

const profile: ExtractedCandidate = {
  firstName: 'Ganna',
  lastName: 'Farid',
  email: 'ganna.farid@example.com',
  title: 'Talent Acquisition Specialist',
  experienceYears: 6,
};

function renderAssigner(duplicateCandidates: DuplicateCandidate[] = []) {
  render(
    <CVMatchAssigner
      profile={profile}
      vacancies={[]}
      targetVacancy="pool"
      setTargetVacancy={vi.fn()}
      targetStage="Screening"
      setTargetStage={vi.fn()}
      candidateSource="CV Intake Upload"
      candidateSourceOptions={['CV Intake Upload']}
      setCandidateSource={vi.fn()}
      duplicateDecision={duplicateCandidates.length > 0 ? 'update' : 'new'}
      setDuplicateDecision={vi.fn()}
      duplicateCandidates={duplicateCandidates}
      checkingDuplicates={false}
      duplicateCheckError={null}
      submitting={false}
      onBack={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );
}

describe('CVMatchAssigner duplicate resolution', () => {
  it('defaults to a new profile when no duplicate was returned', () => {
    renderAssigner();

    expect(screen.getAllByText('No duplicate found')).not.toHaveLength(0);
    expect(screen.getByText('Create New Candidate Profile')).toBeInTheDocument();
    expect(screen.queryByText('Update Existing Candidate Profile (Recommended)')).not.toBeInTheDocument();
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('shows update and link actions only for an actual match', () => {
    renderAssigner([
      {
        id: 'candidate-1',
        candidateCode: 'CAN-0001',
        firstName: 'Ganna',
        lastName: 'Farid',
      },
    ]);

    expect(screen.getByText('Potential duplicate found')).toBeInTheDocument();
    expect(screen.getByText('1 matching candidate found')).toBeInTheDocument();
    expect(screen.getByText('Update Existing Candidate Profile (Recommended)')).toBeInTheDocument();
    expect(screen.getByText('Attach as New Vacancy Application Only')).toBeInTheDocument();
    expect(screen.getByText('CAN-0001')).toBeInTheDocument();
  });
});
