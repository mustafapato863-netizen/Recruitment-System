import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * B2-15 / B2-7: the global ValidationPipe's error. 400 VALIDATION_ERROR with
 * - fields: every offending path ("basePay", "allowances.0.amount", "pay" for an unknown property) -> messages
 * - field: the first offending path, so clients can point at one input.
 * Nested errors are flattened (before, nested DTO errors produced an empty `fields`).
 */
export function flattenValidationErrors(errors: ValidationError[], prefix = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of errors) {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    const msgs = Object.values(e.constraints ?? {});
    if (msgs.length) out[path] = msgs;
    if (e.children?.length) Object.assign(out, flattenValidationErrors(e.children, path));
  }
  return out;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fields = flattenValidationErrors(errors);
  const field = Object.keys(fields)[0];
  return new BadRequestException({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields, ...(field ? { field } : {}) });
}
