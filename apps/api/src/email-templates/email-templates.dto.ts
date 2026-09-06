import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';

export const EMAIL_TEMPLATE_CATEGORIES = ['stage_auto', 'notification', 'misc'] as const;
export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

export class CreateEmailTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  @IsIn(EMAIL_TEMPLATE_CATEGORIES)
  category?: string;

  @IsString()
  subject!: string;

  @IsString()
  bodyTemplate!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateEmailTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(EMAIL_TEMPLATE_CATEGORIES)
  category?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  bodyTemplate?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
