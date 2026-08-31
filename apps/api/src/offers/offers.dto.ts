import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { OfferComponentType } from '@recruitflow/contracts';

export class OfferComponentDto {
  @IsEnum(['Salary', 'Allowance', 'Benefit'])
  type!: OfferComponentType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  amount?: number | null;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsString()
  frequency?: string | null;

  @IsBoolean()
  isTaxable!: boolean;
}

export class CreateOfferDto {
  @IsString()
  applicationId!: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsString()
  probationPeriod?: string;

  @IsOptional()
  @IsDateString()
  offerExpiry?: string;

  @IsOptional()
  @IsDateString()
  proposedJoiningDate?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsString()
  workingSchedule?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferComponentDto)
  components!: OfferComponentDto[];
}

export class CreateOfferRevisionDto {
  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsString()
  probationPeriod?: string;

  @IsOptional()
  @IsDateString()
  offerExpiry?: string;

  @IsOptional()
  @IsDateString()
  proposedJoiningDate?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsString()
  workingSchedule?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferComponentDto)
  components!: OfferComponentDto[];
}

export class OfferDecisionDto {
  @IsEnum(['Approve', 'Reject'])
  decision!: 'Approve' | 'Reject';

  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateOfferStatusDto {
  @IsEnum(['Sent', 'Accepted', 'Declined', 'Withdrawn', 'Expired'])
  status!: 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
}
