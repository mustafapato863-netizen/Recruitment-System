import { useMemo } from 'react';
import type { InterviewType } from '@recruitflow/contracts';
import { INTERVIEW_TYPE_CODES, INTERVIEW_TYPE_FALLBACK } from '../data/masterDataDefaults';
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

function supportedOption(option: MasterDataOption): InterviewTypeOption | null {
  const code = option.code && INTERVIEW_TYPE_CODES.has(option.code as InterviewType)
    ? option.code as InterviewType
    : INTERVIEW_TYPE_FALLBACK.find((item) => item.name.toLowerCase() === option.name.toLowerCase())?.code;
  if (!code) return null;
  const fallback = INTERVIEW_TYPE_FALLBACK.find((item) => item.code === code)!;
  return { code, name: option.name, defaultDuration: durationFrom(option, fallback.defaultDuration) };
}

export function useInterviewTypeOptions() {
  const fallbackNames = useMemo(() => INTERVIEW_TYPE_FALLBACK.map((item) => item.name), []);
  const result = useMasterDataOptions('interview-types', fallbackNames);
  const options = useMemo(() => {
    const deduped = new Map<InterviewType, InterviewTypeOption>();
    result.options.forEach((option) => {
      const normalized = supportedOption(option);
      if (normalized && !deduped.has(normalized.code)) deduped.set(normalized.code, normalized);
    });
    return deduped.size > 0 ? Array.from(deduped.values()) : INTERVIEW_TYPE_FALLBACK;
  }, [result.options]);
  return { ...result, options };
}
