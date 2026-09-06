import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { EmailTemplateItem } from '@recruitflow/contracts';
import type { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './email-templates.dto';

/**
 * Four Odoo-equivalent default stage-automation email templates seeded
 * per organisation on first access. Default templates are read-only from
 * the admin UI (isDefault=true); users can duplicate to customise.
 */
const DEFAULT_TEMPLATES = [
  {
    name: 'Application Received — Acknowledgement',
    category: 'stage_auto',
    subject: 'We received your application for {{positionTitle}}',
    bodyTemplate: `Dear {{candidateName}},

Thank you for applying for the {{positionTitle}} position at {{organizationName}}. We have received your application and our team will review it shortly.

We will be in touch with next steps as soon as possible.

Best regards,
{{organizationName}} Recruitment Team`,
    isDefault: true,
  },
  {
    name: 'Screening Invitation',
    category: 'stage_auto',
    subject: 'Next step for your {{positionTitle}} application',
    bodyTemplate: `Dear {{candidateName}},

Congratulations! After reviewing your application for {{positionTitle}}, we would like to invite you to the next stage of our recruitment process — the screening stage.

Our team will reach out shortly to arrange a convenient time.

Best regards,
{{organizationName}} Recruitment Team`,
    isDefault: true,
  },
  {
    name: 'Interview Invitation',
    category: 'stage_auto',
    subject: 'Interview Invitation — {{positionTitle}}',
    bodyTemplate: `Dear {{candidateName}},

We are pleased to invite you to an interview for the {{positionTitle}} position at {{organizationName}}.

Our recruiter will contact you to schedule a suitable time. Please ensure your availability and prepare any required documents.

We look forward to meeting you!

Best regards,
{{organizationName}} Recruitment Team`,
    isDefault: true,
  },
  {
    name: 'Application Not Progressing',
    category: 'stage_auto',
    subject: 'Update on your {{positionTitle}} application',
    bodyTemplate: `Dear {{candidateName}},

Thank you for your interest in the {{positionTitle}} position at {{organizationName}} and for the time you invested in our recruitment process.

After careful consideration, we will not be progressing with your application at this stage. We appreciate your interest and encourage you to apply for future opportunities that match your profile.

We wish you the best in your career journey.

Best regards,
{{organizationName}} Recruitment Team`,
    isDefault: true,
  },
];

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(organizationId: string): Promise<EmailTemplateItem[]> {
    await this.ensureDefaults(organizationId);
    const templates = await this.prisma.emailTemplate.findMany({
      where: { organizationId, status: { not: 'Archived' } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return templates.map(this.toItem);
  }

  async getTemplate(organizationId: string, id: string): Promise<EmailTemplateItem> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!template) throw new NotFoundException('Email template not found');
    return this.toItem(template);
  }

  async createTemplate(organizationId: string, dto: CreateEmailTemplateDto): Promise<EmailTemplateItem> {
    const created = await this.prisma.emailTemplate.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        category: dto.category ?? 'stage_auto',
        subject: dto.subject.trim(),
        bodyTemplate: dto.bodyTemplate.trim(),
        isDefault: false,
        status: 'Active',
      },
    });
    return this.toItem(created);
  }

  async updateTemplate(organizationId: string, id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplateItem> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!template) throw new NotFoundException('Email template not found');
    if (template.isDefault) throw new ConflictException('Default templates cannot be edited. Duplicate this template to customise it.');

    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.subject !== undefined && { subject: dto.subject.trim() }),
        ...(dto.bodyTemplate !== undefined && { bodyTemplate: dto.bodyTemplate.trim() }),
      },
    });
    return this.toItem(updated);
  }

  async archiveTemplate(organizationId: string, id: string): Promise<void> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!template) throw new NotFoundException('Email template not found');
    if (template.isDefault) throw new ConflictException('Default templates cannot be deleted.');

    await this.prisma.emailTemplate.update({ where: { id }, data: { status: 'Archived' } });
  }

  async duplicateTemplate(organizationId: string, id: string): Promise<EmailTemplateItem> {
    const source = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!source) throw new NotFoundException('Email template not found');

    const created = await this.prisma.emailTemplate.create({
      data: {
        organizationId,
        name: `${source.name} (Copy)`,
        category: source.category,
        subject: source.subject,
        bodyTemplate: source.bodyTemplate,
        isDefault: false,
        status: 'Active',
      },
    });
    return this.toItem(created);
  }

  /**
   * Render a template body by substituting supported variables.
   * Pure function — no I/O.
   */
  static render(bodyTemplate: string, vars: Record<string, string>): string {
    return bodyTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
  }

  // ─── Private helpers ───────────────────────────────────────────

  /**
   * Seeds the 4 Odoo-equivalent default templates once per organisation.
   * Idempotent: skips if at least one isDefault template already exists.
   */
  private async ensureDefaults(organizationId: string): Promise<void> {
    const existing = await this.prisma.emailTemplate.count({
      where: { organizationId, isDefault: true },
    });
    if (existing > 0) return;

    await this.prisma.emailTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({ ...t, organizationId, status: 'Active' })),
      skipDuplicates: true,
    });
  }

  private toItem(record: {
    id: string;
    organizationId: string;
    name: string;
    category: string;
    subject: string;
    bodyTemplate: string;
    isDefault: boolean;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): EmailTemplateItem {
    return {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      category: record.category,
      subject: record.subject,
      bodyTemplate: record.bodyTemplate,
      isDefault: record.isDefault,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
