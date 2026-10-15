import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALLOWED_INTEGRATION_PROVIDERS, IntegrationsService } from '../integrations.service';

const ORG = '10000000-0000-4000-8000-000000000001';
const SECRET = 'cipher-blob-9f3a';

interface Row {
  id: string;
  organizationId: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  lastSyncAt: Date | null;
  configJson: unknown;
}

interface Where {
  id?: string;
  organizationId: string;
  provider?: { in: string[] };
}

function row(partial: Partial<Row> & Pick<Row, 'id' | 'provider'>): Row {
  return {
    organizationId: ORG,
    name: partial.provider,
    category: 'x',
    status: 'Available',
    lastSyncAt: null,
    configJson: null,
    ...partial,
  };
}

function harness(initial: Row[]) {
  const rows = initial.map((item) => ({ ...item }));
  const matches = (where: Where) => rows.filter((item) => item.organizationId === where.organizationId && (!where.id || item.id === where.id) && (!where.provider?.in || where.provider.in.includes(item.provider)));
  const prisma = {
    integration: {
      findMany: vi.fn(async ({ where, select }: { where: Where; select?: { provider?: boolean } }) => {
        const found = matches(where);
        return select?.provider ? found.map((item) => ({ provider: item.provider })) : found.map((item) => ({ ...item }));
      }),
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        const found = matches(where)[0];
        return found ? { ...found } : null;
      }),
      createMany: vi.fn(async ({ data }: { data: Array<Omit<Row, 'id' | 'lastSyncAt' | 'configJson'> & { id?: string; configJson?: unknown }> }) => {
        for (const item of data) {
          rows.push({
            id: item.id ?? `seed-${rows.length + 1}`,
            organizationId: item.organizationId,
            name: item.name,
            provider: item.provider,
            category: item.category,
            status: item.status ?? 'Available',
            lastSyncAt: null,
            configJson: item.configJson ?? null,
          });
        }
        return { count: data.length };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const found = rows.find((item) => item.id === where.id);
        if (!found) throw new Error('missing integration');
        Object.assign(found, data);
        return { ...found };
      }),
    },
  };
  return { rows, prisma, svc: new IntegrationsService(prisma as never) };
}

const smtpConfig = {
  smtpHost: 'smtp.internal',
  fromAddress: 'hr@recruitflow.local',
  port: 587,
  apiKey: 'super-secret-plain',
  apiKeyEncrypted: SECRET,
  clientSecret: 'client-secret-plain',
  refreshToken: 'refresh-token-plain',
  accessToken: 'access-token-plain',
  clientSecretEncrypted: 'client-cipher',
};

function assertNoSecrets(value: unknown) {
  const encoded = JSON.stringify(value);
  for (const secret of [SECRET, 'super-secret-plain', 'client-secret-plain', 'refresh-token-plain', 'access-token-plain', 'client-cipher']) {
    expect(encoded).not.toContain(secret);
  }
  expect(encoded).not.toMatch(/apiKey|clientSecret|refreshToken|accessToken|Encrypted/);
}

describe('integration settings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the provider allowlist to careers publishing and mail', async () => {
    expect([...ALLOWED_INTEGRATION_PROVIDERS]).toEqual(['careers_site', 'smtp']);
    const { prisma, svc } = harness([]);
    const list = await svc.listIntegrations(ORG);
    expect(list.map((item) => item.provider).sort()).toEqual(['careers_site', 'smtp']);
    const created = prisma.integration.createMany.mock.calls.flatMap((call) => (call[0] as { data: Array<{ provider: string }> }).data);
    expect(created.map((item) => item.provider).sort()).toEqual(['careers_site', 'smtp']);
    expect(created.some((item) => /whatsapp|calendar|meet/i.test(item.provider))).toBe(false);
  });

  it('returns saved public settings and hides encrypted secrets', async () => {
    const smtp = row({
      id: 'smtp-1',
      name: 'Email Provider',
      provider: 'smtp',
      category: 'Communication',
      status: 'Connected',
      configJson: {
        smtpHost: 'mail.internal',
        fromAddress: 'hr@recruitflow.local',
        port: '2525',
        apiKey: 'super-secret-plain',
        apiKeyEncrypted: SECRET,
        clientSecret: 'client-secret-plain',
        refreshToken: 'refresh-token-plain',
        accessToken: 'access-token-plain',
        clientSecretEncrypted: 'client-cipher',
      },
    });
    const careers = row({
      id: 'careers-1',
      name: 'Careers site publishing',
      provider: 'careers_site',
      category: 'Publishing',
      status: 'Connected',
      configJson: { careersUrl: 'https://careers.example.com/jobs', apiKeyEncrypted: SECRET },
    });
    const hidden = [
      row({ id: 'wa-1', provider: 'whatsapp' }),
      row({ id: 'cal-1', provider: 'google_calendar' }),
      row({ id: 'meet-1', provider: 'google_meet' }),
    ];
    const { prisma, svc } = harness([smtp, careers, ...hidden]);
    const list = await svc.listIntegrations(ORG);
    expect(list.map((item) => item.provider).sort()).toEqual(['careers_site', 'smtp']);
    const mail = list.find((item) => item.provider === 'smtp');
    expect(mail).toMatchObject({ status: 'Not verified', smtpHost: 'mail.internal', fromAddress: 'hr@recruitflow.local', port: 2525 });
    expect(list.find((item) => item.provider === 'careers_site')).toMatchObject({ status: 'Connected', careersUrl: 'https://careers.example.com/jobs' });
    assertNoSecrets(list);

    const saved = await svc.updateIntegration(ORG, smtp.id, { configJson: { smtpHost: 'smtp.internal', fromAddress: 'hr@recruitflow.local', port: 587 } });
    expect(saved).toMatchObject({ smtpHost: 'smtp.internal', fromAddress: 'hr@recruitflow.local', port: 587, status: 'Not verified' });
    expect(prisma.integration.update).toHaveBeenCalledWith({
      where: { id: smtp.id },
      data: { configJson: { smtpHost: 'smtp.internal', fromAddress: 'hr@recruitflow.local', port: 587 } },
    });
    expect(prisma.integration.update.mock.calls[0]?.[0]).not.toHaveProperty('data.status');
    assertNoSecrets(saved);

    const poisoned = await svc.updateIntegration(ORG, smtp.id, { configJson: smtpConfig });
    expect(poisoned).toMatchObject({ smtpHost: 'smtp.internal', fromAddress: 'hr@recruitflow.local', port: 587 });
    assertNoSecrets(poisoned);
    const stored = JSON.stringify(prisma.integration.update.mock.calls.at(-1)?.[0].data.configJson);
    expect(stored).not.toContain('super-secret-plain');
    expect(stored).not.toContain(SECRET);
  });

  it('rejects a Connected save and does not send mail from the SMTP test', async () => {
    const smtp = row({ id: 'smtp-1', provider: 'smtp', status: 'Available' });
    const calendar = row({ id: 'cal-1', provider: 'google_calendar' });
    const { prisma, svc } = harness([smtp, calendar]);
    const error = await svc.updateIntegration(ORG, smtp.id, { status: 'Connected', configJson: { smtpHost: 'smtp.internal' } }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'PROVIDER_NOT_VERIFIED' });
    expect(prisma.integration.update).not.toHaveBeenCalled();

    const missing = await svc.testIntegration(ORG, calendar.id).catch((caught: unknown) => caught);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(prisma.integration.update).not.toHaveBeenCalled();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network must not be called'));
    const result = await svc.testIntegration(ORG, smtp.id);
    expect(result).toEqual({
      success: false,
      verified: false,
      message: 'Mail delivery is not verified. A saved provider setting is not a connection, and this server does not send to candidates.',
    });
    expect(result.message).not.toMatch(/\bSent\b/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.integration.update).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
