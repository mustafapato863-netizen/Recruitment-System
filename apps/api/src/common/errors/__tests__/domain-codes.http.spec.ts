import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, ForbiddenException, Get, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { errorCodes } from '@recruitflow/contracts';
import { HttpExceptionFilter } from '../../filters/http-exception.filter';
import { normalizeError } from '../error-normalizer';
import { GATE_CODES, assertJoiningChecks } from '../../../applications/application-gates';

class GateController {
  async gate() {
    await assertJoiningChecks({ joiningCheck: { findMany: async () => [{ type: 'ID' }] } } as never, 'app-1');
  }
  reopen() {
    throw new ForbiddenException({ code: 'REOPEN_NOT_OWNER', message: 'Only the owner of this file or their manager can reopen it.' });
  }
}
// Decorators applied by hand (the test transform does not run TS decorators in spec files).
for (const [route, method] of [['gate', 'gate'], ['reopen', 'reopen']] as const) {
  Get(route)(GateController.prototype, method, Object.getOwnPropertyDescriptor(GateController.prototype, method)!);
}
Controller('t')(GateController);
class TestModule {}
Module({ controllers: [GateController] })(TestModule);

const REQUIRED = [
  ...Object.values(GATE_CODES),
  'ROOM_REQUIRED', 'ROOM_URL_INVALID', 'ROOM_URL_NOT_HTTPS', 'ROOM_URL_HOST_NOT_ALLOWED',
  'INTERVIEWER_NOT_A_USER', 'SCORECARD_ALREADY_SUBMITTED', 'OFFER_CLOSED', 'REOPEN_NOT_OWNER', 'REOPEN_REASON_REQUIRED', 'WITHDRAWN_NOT_AN_EXIT',
  'ILLEGAL_JOB_TRANSITION', 'REQUISITION_CANCELLED', 'JOB_NOT_ACCEPTING_APPLICATIONS', 'NOT_JOB_OWNER',
  'OFFER_NOT_DRAFT', 'OFFER_NOT_APPROVED', 'OFFER_CHANNEL_INVALID', 'OFFER_TEMPLATE_INVALID', 'OFFER_TEMPLATE_CHANNEL_MISMATCH', 'FOLLOW_UP_NOT_OWNER',
];

describe('B5 domain error codes', () => {
  let app: INestApplication;
  let base = '';
  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });
  afterAll(async () => { await app?.close(); });

  it('every new code is in the shared registry (= normalizer allowlist)', () => {
    for (const code of REQUIRED) expect(errorCodes as readonly string[]).toContain(code);
  });

  it('HTTP: a gate 409 keeps code, gate and missing[]', async () => {
    const res = await fetch(`${base}/t/gate`);
    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ statusCode: 409, code: 'GATE_JOINING_CHECKS_INCOMPLETE', gate: 'joining-checks', missing: ['CONTRACT', 'SCFHS_LICENCE'] });
  });

  it('HTTP: a non-gate domain code is kept (not collapsed to FORBIDDEN)', async () => {
    const res = await fetch(`${base}/t/reopen`);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'REOPEN_NOT_OWNER' });
  });

  it('gate/missing are only passed through for GATE_* codes and safe shapes', async () => {
    const { ConflictException } = await import('@nestjs/common');
    expect(normalizeError(new ConflictException({ code: 'OFFER_CLOSED', gate: 'x', missing: ['y'] }))).not.toHaveProperty('gate');
    expect(normalizeError(new ConflictException({ code: 'GATE_OFFER_NOT_ACCEPTED', gate: 'g', missing: [{ evil: 1 }] }))).not.toHaveProperty('missing');
    expect(normalizeError(new ConflictException({ code: 'NOT_A_REGISTERED_CODE' })).code).toBe('CONFLICT');
  });
});
