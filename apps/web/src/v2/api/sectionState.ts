import { ApiError } from '../../api/client';

/**
 * Shared read-state for application-file sections (ticket 05) and later
 * count/action work (ticket 06). A successful empty list is `empty`.
 * Permission skips and 403s are `unavailable`. Not-found, domain, and
 * transient failures stay distinct and are never stored as an empty list.
 */
export const FILE_SECTION_KEYS = [
  'history',
  'notes',
  'screening',
  'interviews',
  'scorecards',
  'offer',
  'hiring',
  'joiningChecks',
  'documents',
  'messages',
] as const;

export type FileSectionKey = (typeof FILE_SECTION_KEYS)[number];

export const SECTION_LABEL: Record<FileSectionKey, string> = {
  history: 'History',
  notes: 'Notes',
  screening: 'Screening',
  interviews: 'Interviews',
  scorecards: 'Scorecards',
  offer: 'The offer',
  hiring: 'Hiring',
  joiningChecks: 'Joining checks',
  documents: 'Documents',
  messages: 'Messages',
};

export type SectionFailureKind = 'not-found' | 'domain' | 'transient';

export type SectionState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'error'; failure: SectionFailureKind; statusCode: number | null; message: string };

export function unavailableSection<T>(): SectionState<T> {
  return { status: 'unavailable' };
}

export function emptySection<T>(): SectionState<T> {
  return { status: 'empty' };
}

export function readySection<T>(data: T): SectionState<T> {
  return { status: 'ready', data };
}

/** Absent on older fixtures means the read already succeeded. */
export function isSectionKnown(state: SectionState<unknown> | undefined): boolean {
  if (!state) return true;
  return state.status === 'ready' || state.status === 'empty';
}

export function classifyReadError(error: unknown): Extract<SectionState<never>, { status: 'unavailable' | 'error' }> {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return { status: 'unavailable' };
    if (error.statusCode === 404) {
      return {
        status: 'error',
        failure: 'not-found',
        statusCode: 404,
        message: error.message || 'This part of the file could not be found.',
      };
    }
    if (error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500 || error.retryable === true) {
      return {
        status: 'error',
        failure: 'transient',
        statusCode: error.statusCode,
        message: error.message || 'This part of the file could not be loaded. Try again.',
      };
    }
    return {
      status: 'error',
      failure: 'domain',
      statusCode: error.statusCode,
      message: error.message || 'This part of the file could not be loaded.',
    };
  }
  const message = error instanceof Error && error.message
    ? error.message
    : 'This part of the file could not be loaded. Try again.';
  return { status: 'error', failure: 'transient', statusCode: null, message };
}

export function sectionProblem(
  label: string,
  state: SectionState<unknown> | undefined,
): { tone: 'loading' | 'unavailable' | 'not-found' | 'transient' | 'domain'; message: string } | null {
  if (!state || state.status === 'ready' || state.status === 'empty') return null;
  if (state.status === 'loading') return { tone: 'loading', message: `Loading ${label}.` };
  if (state.status === 'unavailable') return { tone: 'unavailable', message: `${label} is not available for this role.` };
  if (state.failure === 'not-found') return { tone: 'not-found', message: `${label} could not be found for this file.` };
  if (state.failure === 'transient') return { tone: 'transient', message: `${label} could not be loaded. Try again.` };
  return { tone: 'domain', message: state.message || `${label} could not be loaded.` };
}

export function canRetrySection(state: SectionState<unknown> | undefined): boolean {
  return state?.status === 'error';
}
