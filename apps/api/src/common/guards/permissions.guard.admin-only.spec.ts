import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from './permissions.guard';
import type { PrismaService } from '../../database/prisma.service';
import { EmailTemplatesController } from '../../email-templates/email-templates.controller';
import { WhatsAppTemplatesController } from '../../whatsapp-templates/whatsapp-templates.controller';

function prismaWith(roleCode: string, permissions: string[]) {
  return {
    user: {
      findUnique: async () => ({
        userRoles: [{ role: { code: roleCode, permissions: permissions.map((code) => ({ permission: { code } })) } }],
      }),
    },
  } as unknown as PrismaService;
}

function ctx(cls: { prototype: object }, method: string): ExecutionContext {
  const handler = (cls.prototype as Record<string, unknown>)[method];
  const req = { tenantId: 'org', user: { userId: 'u', organizationId: 'org' } };
  return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => cls } as unknown as ExecutionContext;
}

const broad = ['MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE', 'APPLICATION_VIEW', 'VACANCY_VIEW'];
const manage: Array<[{ prototype: object }, string]> = [
  [EmailTemplatesController, 'createTemplate'], [EmailTemplatesController, 'updateTemplate'],
  [EmailTemplatesController, 'duplicateTemplate'], [EmailTemplatesController, 'archiveTemplate'],
  [WhatsAppTemplatesController, 'createTemplate'], [WhatsAppTemplatesController, 'updateTemplate'],
  [WhatsAppTemplatesController, 'duplicateTemplate'], [WhatsAppTemplatesController, 'archiveTemplate'],
];
const read: Array<[{ prototype: object }, string]> = [
  [EmailTemplatesController, 'listTemplates'], [EmailTemplatesController, 'getTemplate'],
  [WhatsAppTemplatesController, 'listTemplates'], [WhatsAppTemplatesController, 'getTemplate'],
  [WhatsAppTemplatesController, 'listForSend'], [WhatsAppTemplatesController, 'preview'],
];

describe('B1 follow-up #5: template management is admin-only', () => {
  it.each(manage)('%o.%s: 403 for a non-admin holding every former permission, allowed for admins', async (cls, method) => {
    await expect(new PermissionsGuard(new Reflector(), prismaWith('TALENT_MANAGER', broad)).canActivate(ctx(cls, method))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(new PermissionsGuard(new Reflector(), prismaWith('ADMINISTRATOR', [])).canActivate(ctx(cls, method))).resolves.toBe(true);
  });

  it.each(read)('%o.%s: reading/sending still works for non-admins', async (cls, method) => {
    await expect(new PermissionsGuard(new Reflector(), prismaWith('RECRUITER', ['APPLICATION_VIEW'])).canActivate(ctx(cls, method))).resolves.toBe(true);
  });
});
