import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const TASK_STATUSES = ['Open', 'In Progress', 'Completed', 'Dismissed'] as const;
const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

export class UpdateTaskStatusDto {
  @IsIn(TASK_STATUSES)
  status!: string;
}

export class CreateTaskDto {
  @IsUUID()
  @IsNotEmpty()
  assigneeUserId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}
