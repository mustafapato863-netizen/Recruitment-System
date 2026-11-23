import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { AssistantSeat } from '@recruitflow/contracts';

export class AssistantHistoryTurnDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1200)
  content!: string;
}

export class AssistantAskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  question!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentRoute?: string;

  @IsOptional()
  @IsString()
  @IsIn(['employee', 'manager', 'admin'])
  seat?: AssistantSeat;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  errorCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryTurnDto)
  history?: AssistantHistoryTurnDto[];
}

export class AssistantSuggestionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentRoute?: string;

  @IsOptional()
  @IsString()
  @IsIn(['employee', 'manager', 'admin'])
  seat?: AssistantSeat;
}
