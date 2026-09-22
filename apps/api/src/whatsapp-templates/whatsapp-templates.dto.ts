import { IsIn, IsOptional, IsString } from 'class-validator';

export const WHATSAPP_TEMPLATE_CATEGORIES = [
  'ack',
  'interview_invite',
  'offer_next_step',
  'rejection',
  'misc',
] as const;
export type WhatsAppTemplateCategory = (typeof WHATSAPP_TEMPLATE_CATEGORIES)[number];

export const WHATSAPP_INTERVIEW_TYPES = [
  'Any',
  'Screening',
  'Technical',
  'Behavioral',
  'Managerial',
  'Executive',
] as const;

export class CreateWhatsAppTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  @IsIn(WHATSAPP_TEMPLATE_CATEGORIES)
  category?: string;

  @IsString()
  @IsOptional()
  @IsIn(WHATSAPP_INTERVIEW_TYPES)
  interviewType?: string;

  @IsString()
  bodyTemplate!: string;
}

export class UpdateWhatsAppTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(WHATSAPP_TEMPLATE_CATEGORIES)
  category?: string;

  @IsString()
  @IsOptional()
  @IsIn(WHATSAPP_INTERVIEW_TYPES)
  interviewType?: string;

  @IsString()
  @IsOptional()
  bodyTemplate?: string;
}

export class RenderWhatsAppTemplateDto {
  @IsString()
  @IsOptional()
  candidateName?: string;

  @IsString()
  @IsOptional()
  positionTitle?: string;

  @IsString()
  @IsOptional()
  organizationName?: string;

  @IsString()
  @IsOptional()
  interviewType?: string;

  @IsString()
  @IsOptional()
  interviewDate?: string;

  @IsString()
  @IsOptional()
  recruiterName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  bodyOverride?: string;
}
