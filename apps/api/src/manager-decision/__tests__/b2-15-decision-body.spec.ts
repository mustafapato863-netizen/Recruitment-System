/** B2-15: the offer-decision body is FLAT only; validation failures are 400 with a code and the offending field. */
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ManagerDecisionDto } from '../manager-decision.controller';
import { validationExceptionFactory } from '../../common/errors/validation-exception';
import { buildErrorEnvelope, normalizeError } from '../../common/errors/error-normalizer';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, exceptionFactory: validationExceptionFactory });
const run = (body: unknown) => pipe.transform(body, { type: 'body', metatype: ManagerDecisionDto });
async function envelope(body: unknown) {
  try { await run(body); } catch (e) { return buildErrorEnvelope(normalizeError(e as never) as never, 'req-1'); }
  throw new Error('expected a 400');
}

describe('B2-15 offer decision body', () => {
  it('accepts the flat shape', async () => {
    const dto = await run({ decision: 'Approve', basePay: 15000, currency: 'AED', allowances: [{ name: 'Housing', amount: 2000 }] });
    expect(dto).toMatchObject({ decision: 'Approve', basePay: 15000, currency: 'AED' });
  });

  it('rejects the nested {pay:{...}} shape: 400 VALIDATION_ERROR, field "pay"', async () => {
    const env = await envelope({ decision: 'Approve', pay: { basePay: 15000, currency: 'AED', allowances: [] } });
    expect(env).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', field: 'pay' });
    expect(Object.keys(env.fields ?? {})).toEqual(['pay']);
  });

  it('names the offending field, including nested allowance paths', async () => {
    expect(await envelope({ decision: 'Approve', basePay: -1, currency: 'AED' })).toMatchObject({ code: 'VALIDATION_ERROR', field: 'basePay' });
    expect(await envelope({ decision: 'Approve', basePay: 1, currency: 'AED', allowances: [{ name: 'Housing', amount: 'x' }] })).toMatchObject({ code: 'VALIDATION_ERROR', field: 'allowances.0.amount' });
    expect(await envelope({ decision: 'Maybe' })).toMatchObject({ code: 'VALIDATION_ERROR', field: 'decision' });
  });
});
