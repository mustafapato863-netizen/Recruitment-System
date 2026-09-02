import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { normalizeError } from './error-normalizer';

describe('Error Normalizer', () => {
  it('handles raw runtime errors (unsafe exceptions) safely', () => {
    const error = new Error('Cannot read properties of undefined (reading "id")');
    const result = normalizeError(error);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('An unexpected server error occurred. Please contact support if the issue persists.');
    expect(result.logContext).toBe(error.message); // Context logged but not returned to client
  });

  it('aggressively prevents Prisma/SQL leakage', () => {
    // Simulate a HttpException with a leaky message
    const error = new HttpException('PrismaClient error: Invalid query SELECT * FROM users', 500);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
    // The fail-safe policy should scrub this
    expect(result.message).toBe('An unexpected server error occurred. Please contact support if the issue persists.');
  });

  it('prevents file path leakage', () => {
    const error = new HttpException('Failed to open /app/secrets/config.json', 500);
    const result = normalizeError(error);
    expect(result.message).toBe('An unexpected server error occurred. Please contact support if the issue persists.');
  });

  it('prevents token leakage', () => {
    const error = new HttpException('Invalid JWT token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 500);
    const result = normalizeError(error);
    expect(result.message).toBe('An unexpected server error occurred. Please contact support if the issue persists.');
  });

  it('does not expose unsafe diagnostics from a non-5xx HttpException', () => {
    const error = new HttpException('password=topsecret /home/app/config', 400);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(400);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toBe('Please correct the highlighted fields.');
  });

  it('does not expose an absolute path from a 404 HttpException', () => {
    const error = new HttpException('Missing /home/recruitflow/secrets/cv.pdf', 404);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(404);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('The requested record or resource was not found.');
  });

  it('preserves safe business messages', () => {
    const error = new HttpException({
      code: 'IMPORT_INVALID',
      message: 'The uploaded file format is not supported for import.',
    }, 400);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(400);
    expect(result.code).toBe('IMPORT_INVALID');
    expect(result.message).toBe('The uploaded file format is not supported for import.');
  });

  it('handles array messages', () => {
    const error = new HttpException({
      code: 'VALIDATION_ERROR',
      message: ['Email is required', 'Display name must be provided'],
    }, 400);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(400);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toBe('Email is required, Display name must be provided');
  });

  it('handles field validation errors', () => {
    const error = new HttpException({
      code: 'VALIDATION_ERROR',
      fields: {
        email: ['Invalid email'],
      },
    }, 400);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(400);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toBe('Please correct the highlighted fields.');
    expect(result.fields).toEqual({ email: ['Invalid email'] });
  });

  it('maps standard status codes correctly', () => {
    const error404 = new HttpException('Not found', 404);
    expect(normalizeError(error404).code).toBe('NOT_FOUND');
    
    const error403 = new HttpException('Forbidden', 403);
    expect(normalizeError(error403).code).toBe('FORBIDDEN');
    
    const error429 = new HttpException('Rate limited', 429);
    expect(normalizeError(error429).code).toBe('RATE_LIMITED');
  });

  it('preserves retry metadata for 429/502/503', () => {
    const error = new HttpException({
      code: 'INTEGRATION_UNAVAILABLE',
      message: 'Service is down',
      retryable: true,
      retryAfterSeconds: 120,
    }, 503);
    const result = normalizeError(error);
    expect(result.statusCode).toBe(503);
    expect(result.retryable).toBe(true);
    expect(result.retryAfterSeconds).toBe(120);
  });
});
