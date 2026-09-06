import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { EmailTemplatesService } from '../email-templates.service';
import type { PrismaService } from '../../database/prisma.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockEmailTemplateDelegate {
  count: MockFn;
  createMany: MockFn;
  findMany: MockFn;
  findFirst: MockFn;
  create: MockFn;
  update: MockFn;
}

interface MockPrisma {
  emailTemplate: MockEmailTemplateDelegate;
}

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;
  let mockPrisma: MockPrisma;

  const sampleTemplate = {
    id: 'tpl-1',
    organizationId: 'org-123',
    name: 'Interview Invitation',
    category: 'stage_auto',
    subject: 'Interview for {{positionTitle}}',
    bodyTemplate: 'Dear {{candidateName}}, welcome to {{organizationName}}!',
    isDefault: false,
    status: 'Active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const defaultTemplate = {
    ...sampleTemplate,
    id: 'tpl-default',
    name: 'Screening Invitation',
    isDefault: true,
  };

  beforeEach(() => {
    mockPrisma = {
      emailTemplate: {
        count: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new EmailTemplatesService(mockPrisma as PrismaService);
  });

  describe('render static method', () => {
    it('interpolates known variables into template string', () => {
      const template = 'Dear {{candidateName}}, you are invited for {{positionTitle}} at {{organizationName}}. Stage: {{stageName}}';
      const rendered = EmailTemplatesService.render(template, {
        candidateName: 'Ahmad Al-Mansoor',
        positionTitle: 'Staff Cardiologist',
        organizationName: 'Saudi German Hospital',
        stageName: 'Interview',
      });
      expect(rendered).toBe('Dear Ahmad Al-Mansoor, you are invited for Staff Cardiologist at Saudi German Hospital. Stage: Interview');
    });

    it('leaves missing variables untouched as {{variable}} placeholders', () => {
      const template = 'Hello {{candidateName}}, {{unknownVar}}';
      const rendered = EmailTemplatesService.render(template, {
        candidateName: 'Sara',
      });
      expect(rendered).toBe('Hello Sara, {{unknownVar}}');
    });
  });

  describe('listTemplates', () => {
    it('seeds defaults when organisation has no default templates', async () => {
      mockPrisma.emailTemplate.count.mockResolvedValue(0);
      mockPrisma.emailTemplate.createMany.mockResolvedValue({ count: 4 });
      mockPrisma.emailTemplate.findMany.mockResolvedValue([defaultTemplate, sampleTemplate]);

      const result = await service.listTemplates('org-123');
      expect(mockPrisma.emailTemplate.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Screening Invitation');
    });

    it('skips seeding if default templates already exist', async () => {
      mockPrisma.emailTemplate.count.mockResolvedValue(4);
      mockPrisma.emailTemplate.findMany.mockResolvedValue([defaultTemplate]);

      const result = await service.listTemplates('org-123');
      expect(mockPrisma.emailTemplate.createMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('createTemplate', () => {
    it('creates a custom template with isDefault=false', async () => {
      mockPrisma.emailTemplate.create.mockResolvedValue({
        ...sampleTemplate,
        id: 'new-id',
        name: 'Offer Letter Notice',
      });

      const result = await service.createTemplate('org-123', {
        name: 'Offer Letter Notice',
        category: 'stage_auto',
        subject: 'Your offer is ready',
        bodyTemplate: 'Dear {{candidateName}}...',
      });

      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-123',
          name: 'Offer Letter Notice',
          isDefault: false,
          status: 'Active',
        }),
      });
      expect(result.name).toBe('Offer Letter Notice');
    });
  });

  describe('updateTemplate', () => {
    it('prevents editing a default template with ConflictException', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(defaultTemplate);

      await expect(
        service.updateTemplate('org-123', 'tpl-default', { name: 'New Name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates custom template successfully', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(sampleTemplate);
      mockPrisma.emailTemplate.update.mockResolvedValue({
        ...sampleTemplate,
        name: 'Updated Subject Title',
      });

      const result = await service.updateTemplate('org-123', 'tpl-1', {
        name: 'Updated Subject Title',
      });
      expect(result.name).toBe('Updated Subject Title');
    });
  });

  describe('archiveTemplate', () => {
    it('prevents deleting a default template with ConflictException', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(defaultTemplate);

      await expect(
        service.archiveTemplate('org-123', 'tpl-default'),
      ).rejects.toThrow(ConflictException);
    });

    it('sets status to Archived for custom template', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(sampleTemplate);
      mockPrisma.emailTemplate.update.mockResolvedValue({
        ...sampleTemplate,
        status: 'Archived',
      });

      await service.archiveTemplate('org-123', 'tpl-1');
      expect(mockPrisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { status: 'Archived' },
      });
    });
  });

  describe('duplicateTemplate', () => {
    it('clones a default or custom template into an editable copy', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(defaultTemplate);
      mockPrisma.emailTemplate.create.mockResolvedValue({
        ...defaultTemplate,
        id: 'cloned-id',
        name: 'Screening Invitation (Copy)',
        isDefault: false,
      });

      const result = await service.duplicateTemplate('org-123', 'tpl-default');
      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-123',
          name: 'Screening Invitation (Copy)',
          isDefault: false,
        }),
      });
      expect(result.isDefault).toBe(false);
      expect(result.name).toBe('Screening Invitation (Copy)');
    });
  });
});
