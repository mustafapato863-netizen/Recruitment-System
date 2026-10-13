import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

/** Activity quotas by position level. Seat counts are not part of this setting. */
export class PositionLevelTargetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  levelCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  levelName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  dailyCalls!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  dailyScreenings!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  monthlyInterviews!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  monthlyOffers!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  targetAcceptanceRate!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(168)
  slaScorecardHours!: number;
}

export class SavePositionLevelTargetsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PositionLevelTargetDto)
  levels!: PositionLevelTargetDto[];
}
