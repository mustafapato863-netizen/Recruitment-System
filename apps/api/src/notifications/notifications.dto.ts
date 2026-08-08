import { IsOptional, IsIn, IsInt, Min, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  unreadOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number;
}

const TASK_STATUSES = ['Open', 'In Progress', 'Completed', 'Dismissed'] as const;
const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

export class TaskQueryDto {
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  overdueOnly?: boolean;

  @IsOptional()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number;
}

export class UpdateTaskStatusDto {
  @IsIn(TASK_STATUSES)
  status!: string;
}
