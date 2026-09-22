import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { WhatsAppTemplateItem } from '@recruitflow/contracts';
import type {
  CreateWhatsAppTemplateDto,
  UpdateWhatsAppTemplateDto,
} from './whatsapp-templates.dto';

const DEFAULT_TEMPLATES = [
  {
    name: 'Application received — WhatsApp ack',
    category: 'ack',
    interviewType: 'Any',
    bodyTemplate: `Hi {{candidateName}},

Thank you for applying for {{positionTitle}} at {{organizationName}}. We have received your application and our team will review it shortly.

Best regards,
{{recruiterName}}
{{organizationName}} Recruitment`,
    isDefault: true,
  },
  {
    name: 'Screening interview invite',
    category: 'interview_invite',
    interviewType: 'Screening',
    bodyTemplate: `Hi {{candidateName}},

We would like to invite you to a {{interviewType}} interview for {{positionTitle}} at {{organizationName}}.

Proposed time: {{interviewDate}}

Please reply on WhatsApp to confirm or suggest another slot.

Thank you,
{{recruiterName}}`,
    isDefault: true,
  },
  {
    name: 'Technical interview invite',
    category: 'interview_invite',
    interviewType: 'Technical',
    bodyTemplate: `Hi {{candidateName}},

Please join us for a {{interviewType}} interview for {{positionTitle}} at {{organizationName}}.

Scheduled: {{interviewDate}}

Reply here to confirm. Looking forward to speaking with you.

{{recruiterName}}
{{organizationName}}`,
    isDefault: true,
  },
  {
    name: 'Behavioral / panel interview invite',
    category: 'interview_invite',
    interviewType: 'Behavioral',
    bodyTemplate: `Hello {{candidateName}},

You are invited to a {{interviewType}} interview for {{positionTitle}} ({{organizationName}}).

Date/time: {{interviewDate}}

Please confirm availability on this chat.

Regards,
{{recruiterName}}`,
    isDefault: true,
  },
  {
    name: 'Managerial interview invite',
    category: 'interview_invite',
    interviewType: 'Managerial',
    bodyTemplate: `Hi {{candidateName}},

Our hiring manager would like to meet you for a {{interviewType}} interview regarding {{positionTitle}} at {{organizationName}}.

Proposed: {{interviewDate}}

Kindly confirm via WhatsApp.

{{recruiterName}}`,
    isDefault: true,
  },
  {
    name: 'Executive interview invite',
    category: 'interview_invite',
    interviewType: 'Executive',
    bodyTemplate: `Dear {{candidateName}},

We would like to invite you to an {{interviewType}} interview for {{positionTitle}} at {{organizationName}}.

Proposed time: {{interviewDate}}

Please confirm on WhatsApp at your earliest convenience.

Warm regards,
{{recruiterName}}
{{organizationName}}`,
    isDefault: true,
  },
  {
    name: 'Offer / next-step WhatsApp',
    category: 'offer_next_step',
    interviewType: 'Any',
    bodyTemplate: `Hi {{candidateName}},

Great news regarding {{positionTitle}} at {{organizationName}}. We would like to discuss next steps / offer details with you.

I will share more shortly — please reply when you are available.

{{recruiterName}}
{{organizationName}} Recruitment`,
    isDefault: true,
  },
  {
    name: 'Application not progressing',
    category: 'rejection',
    interviewType: 'Any',
    bodyTemplate: `Hi {{candidateName}},

Thank you for your interest in {{positionTitle}} at {{organizationName}}. After careful review, we will not be progressing your application at this time.

We appreciate your time and wish you every success.

{{recruiterName}}
{{organizationName}} Recruitment`,
    isDefault: true,
  },
];

@Injectable()
export class WhatsAppTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(organizationId: string): Promise<WhatsAppTemplateItem[]> {
    await this.ensureDefaults(organizationId);
    const templates = await this.prisma.whatsAppTemplate.findMany({
      where: { organizationId, status: { not: 'Archived' } },
      orderBy: [{ isDefault: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });
    return templates.map((row) => this.toItem(row));
  }

  /** Recruiter send picker — filters by interview type (Any always included). */
  async listForSend(
    organizationId: string,
    interviewType?: string,
  ): Promise<WhatsAppTemplateItem[]> {
    await this.ensureDefaults(organizationId);
    const templates = await this.prisma.whatsAppTemplate.findMany({
      where: {
        organizationId,
        status: 'Active',
        ...(interviewType
          ? { OR: [{ interviewType: 'Any' }, { interviewType }] }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return templates.map((row) => this.toItem(row));
  }

  async getTemplate(organizationId: string, id: string): Promise<WhatsAppTemplateItem> {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!template) throw new NotFoundException('WhatsApp template not found');
    return this.toItem(template);
  }

  async createTemplate(
    organizationId: string,
    dto: CreateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateItem> {
    const created = await this.prisma.whatsAppTemplate.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        category: dto.category ?? 'misc',
        interviewType: dto.interviewType ?? 'Any',
        bodyTemplate: dto.bodyTemplate.trim(),
        isDefault: false,
        status: 'Active',
      },
    });
    return this.toItem(created);
  }

  async updateTemplate(
    organizationId: string,
    id: string,
    dto: UpdateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateItem> {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!template) throw new NotFoundException('WhatsApp template not found');
    if (template.isDefault) {
      throw new ConflictException(
        'Default templates cannot be edited. Duplicate this template to customise it.',
      );
    }

    const updated = await this.prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.interviewType !== undefined && { interviewType: dto.interviewType }),
        ...(dto.bodyTemplate !== undefined && { bodyTemplate: dto.bodyTemplate.trim() }),
      },
    });
    return this.toItem(updated);
  }

  async archiveTemplate(organizationId: string, id: string): Promise<void> {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!template) throw new NotFoundException('WhatsApp template not found');
    if (template.isDefault) throw new ConflictException('Default templates cannot be deleted.');
    await this.prisma.whatsAppTemplate.update({ where: { id }, data: { status: 'Archived' } });
  }

  async duplicateTemplate(organizationId: string, id: string): Promise<WhatsAppTemplateItem> {
    const source = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, organizationId, status: { not: 'Archived' } },
    });
    if (!source) throw new NotFoundException('WhatsApp template not found');
    const created = await this.prisma.whatsAppTemplate.create({
      data: {
        organizationId,
        name: `${source.name} (Copy)`,
        category: source.category,
        interviewType: source.interviewType,
        bodyTemplate: source.bodyTemplate,
        isDefault: false,
        status: 'Active',
      },
    });
    return this.toItem(created);
  }

  /** Substitute {{placeholders}}. Pure — no I/O. */
  static render(bodyTemplate: string, vars: Record<string, string>): string {
    return bodyTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
  }

  /** Digits-only E.164-ish phone for wa.me (no +). */
  static normalizePhone(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  static buildWaMeUrl(phone: string, text: string): string {
    const digits = WhatsAppTemplatesService.normalizePhone(phone);
    const q = encodeURIComponent(text);
    return digits ? `https://wa.me/${digits}?text=${q}` : `https://wa.me/?text=${q}`;
  }

  private async ensureDefaults(organizationId: string): Promise<void> {
    const existing = await this.prisma.whatsAppTemplate.count({
      where: { organizationId, isDefault: true },
    });
    if (existing > 0) return;
    await this.prisma.whatsAppTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((row) => ({ ...row, organizationId, status: 'Active' })),
      skipDuplicates: true,
    });
  }

  private toItem(record: {
    id: string;
    organizationId: string;
    name: string;
    category: string;
    interviewType: string;
    bodyTemplate: string;
    isDefault: boolean;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): WhatsAppTemplateItem {
    return {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      category: record.category,
      interviewType: record.interviewType,
      bodyTemplate: record.bodyTemplate,
      isDefault: record.isDefault,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
