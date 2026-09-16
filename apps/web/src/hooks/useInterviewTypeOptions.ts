import { useMemo } from 'react';
import type { InterviewType } from '@recruitflow/contracts';
import { INTERVIEW_TYPE_FALLBACK } from '../data/masterDataDefaults';
import { useMasterDataOptions, type MasterDataOption } from './useMasterDataOptions';

export interface InterviewTypeOption {
  code: InterviewType;
  name: string;
  defaultDuration: number;
}

function durationFrom(option: MasterDataOption, fallback: number): number {
  const value = option.metadata?.defaultDuration;
  return typeof value === 'number' && Number.isFinite(value) && value >= 15 && value <= 240
    ? Math.round(value)
    : fallback;
}

function toInterviewTypeOption(option: MasterDataOption): InterviewTypeOption | null {
  const name = option.name?.trim();
  if (!name) return null;

  // Match known standard fallback types (case-insensitively by name or code)
  const fallback = INTERVIEW_TYPE_FALLBACK.find((item) =>
    item.name.toLowerCase() === name.toLowerCase() ||
    (option.code && item.code.toLowerCase() === option.code.trim().toLowerCase())
  );

  const code = (fallback ? fallback.code : (option.code?.trim() || name)) as InterviewType;
  const defaultDuration = durationFrom(option, fallback?.defaultDuration ?? 45);

  return { code, name, defaultDuration };
}

export function useInterviewTypeOptions() {
  const fallbackNames = useMemo(() => INTERVIEW_TYPE_FALLBACK.map((item) => item.name), []);
  const result = useMasterDataOptions('interview-types', fallbackNames);
  const options = useMemo(() => {
    const deduped = new Map<string, InterviewTypeOption>();
    result.options.forEach((option) => {
      const normalized = toInterviewTypeOption(option);
      if (normalized && !deduped.has(normalized.code.toLowerCase())) {
        deduped.set(normalized.code.toLowerCase(), normalized);
      }
    });
    return deduped.size > 0 ? Array.from(deduped.values()) : INTERVIEW_TYPE_FALLBACK;
  }, [result.options]);
  return { ...result, options };
}

