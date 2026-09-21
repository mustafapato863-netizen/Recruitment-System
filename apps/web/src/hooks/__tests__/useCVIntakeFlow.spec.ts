import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCVIntakeFlow } from '../useCVIntakeFlow';
import * as apiClient from '../../api/client';
import { calculateCandidateFitScore } from '@recruitflow/validation';
import type * as ValidationModule from '@recruitflow/validation';
import { ToastProvider } from '../../components/ui/ToastContext';

vi.mock('../../api/client', () => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  postFormDataApi: vi.fn(),
  patchApi: vi.fn(),
}));

vi.mock('@recruitflow/validation', async (importOriginal) => {
  const actual = await importOriginal<typeof ValidationModule>();
  return {
    ...actual,
    calculateCandidateFitScore: vi.fn(actual.calculateCandidateFitScore),
  };
});

describe('useCVIntakeFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getApi).mockImplementation((url: string) => {
      if (url.includes('/vacancies')) {
        return Promise.resolve([{ id: 'v1', title: 'Developer', requiredSkills: ['React'] }]);
      }
      if (url.includes('/candidates/import/jobs')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve([]);
    });
  });

  it('updates scoredVacancies when educationHistory is edited', async () => {
    const { result } = renderHook(() => useCVIntakeFlow(), { wrapper: ToastProvider });

    // Set initial profile
    act(() => {
      result.current.setProfile({
        firstName: 'John',
        lastName: 'Doe',
        educationHistory: [],
      });
    });

    // Wait for the hook to fetch vacancies and for the debounce to settle
    await waitFor(() => {
      expect(result.current.scoredVacancies.length).toBeGreaterThan(0);
    });

    // Reset the mock to track the next call
    vi.mocked(calculateCandidateFitScore).mockClear();

    // Update educationHistory
    act(() => {
      result.current.setProfile({
        firstName: 'John',
        lastName: 'Doe',
        educationHistory: [{ organization: 'MIT', degree: 'BSc' }],
      });
    });

    // Verify calculateCandidateFitScore is called again after debounce
    await waitFor(() => {
      expect(calculateCandidateFitScore).toHaveBeenCalled();
      const callArgs = vi.mocked(calculateCandidateFitScore).mock.calls[0][0];
      expect(callArgs.educationHistory).toEqual([{ organization: 'MIT', degree: 'BSc' }]);
    });
  });

  it('keeps the General Talent Pool selection when vacancies are scored', async () => {
    const { result } = renderHook(() => useCVIntakeFlow(), { wrapper: ToastProvider });

    act(() => {
      result.current.setProfile({
        firstName: 'John',
        lastName: 'Doe',
        skills: ['React'],
        experienceYears: 3,
      });
    });

    await waitFor(() => {
      expect(result.current.scoredVacancies.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.setTargetVacancy('pool');
    });

    await waitFor(() => {
      expect(result.current.targetVacancy).toBe('pool');
    });
  });
});
