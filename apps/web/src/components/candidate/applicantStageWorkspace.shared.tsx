import type { ApplicationWorkspaceResponse } from '@recruitflow/contracts';

export type ApplicantWorkspaceStage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Pre-Hire' | 'Joined';

export const STANDARD_STAGE_NAMES = new Set(['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined']);

export type OfferDraft = {
  contractType: string;
  probationPeriod: string;
  offerExpiry: string;
  proposedJoiningDate: string;
  workLocation: string;
  workingSchedule: string;
  amount: string;
  currency: string;
};

export const emptyOfferDraft = (location: string): OfferDraft => ({
  contractType: 'Permanent',
  probationPeriod: '6 Months',
  offerExpiry: '',
  proposedJoiningDate: '',
  workLocation: location,
  workingSchedule: 'Full-time (Standard)',
  amount: '',
  currency: 'AED',
});

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to complete this workspace action.';
}

export function toDateInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}
