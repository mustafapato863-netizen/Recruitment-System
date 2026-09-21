import { useCallback } from 'react';
import {
  getErrorMessage,
  toErrorToast,
  toInfoToast,
  toSuccessToast,
  toWarningToast,
} from '../api/errors';
import { useToast } from '../components/ui/ToastContext';

/** Strip legacy success prefixes (checkmark and common mojibake variants). */
function stripLegacyPrefix(message: string): string {
  return message
    .replace(/^[\u2713\u2714\u2705]\s*/u, '')
    .replace(/^\u00ef\u00bf\u00bd+\s*/u, '')
    .trim();
}

function inferTone(message: string): 'success' | 'error' | 'info' | 'warning' {
  const cleaned = stripLegacyPrefix(message);
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith('failed') ||
    lower.includes('unable to') ||
    lower.includes('do not have permission') ||
    lower.includes('error')
  ) {
    return 'error';
  }
  if (lower.includes('warning') || lower.includes('locally') || lower.includes('already assigned')) {
    return 'warning';
  }
  if (
    /^[\u2713\u2714\u2705]/.test(message) ||
    lower.includes('success') ||
    lower.includes('saved') ||
    lower.includes('updated') ||
    lower.includes('deleted') ||
    lower.includes('approved') ||
    lower.includes('scheduled') ||
    lower.includes('copied') ||
    lower.includes('downloaded') ||
    lower.includes('confirmed') ||
    lower.includes('extracted') ||
    lower.includes('moved to') ||
    lower.includes('ingested') ||
    lower.includes('reset')
  ) {
    return 'success';
  }
  return 'info';
}

/**
 * Phase A trust-layer feedback: ToastProvider + shared API error mapping.
 * Prefer success(title) / error(err) over emoji-prefixed notify strings.
 */
export function useFeedback() {
  const { show, dismiss } = useToast();

  const success = useCallback(
    (title: string, message?: string) => show(toSuccessToast(stripLegacyPrefix(title), message)),
    [show],
  );

  const info = useCallback(
    (title: string, message?: string) => show(toInfoToast(stripLegacyPrefix(title), message)),
    [show],
  );

  const warning = useCallback(
    (title: string, message?: string) => show(toWarningToast(stripLegacyPrefix(title), message)),
    [show],
  );

  const error = useCallback(
    (err: unknown, title = 'Request failed') => show(toErrorToast(err, title)),
    [show],
  );

  /** Compatibility helper for screens that previously called showToast(string). */
  const notify = useCallback(
    (message: string, tone?: 'success' | 'error' | 'info' | 'warning') => {
      const cleaned = stripLegacyPrefix(message);
      show({ tone: tone ?? inferTone(message), title: cleaned || message });
    },
    [show],
  );

  return {
    show,
    dismiss,
    success,
    info,
    warning,
    error,
    notify,
    getErrorMessage,
  };
}
