import { IsIn } from 'class-validator';

const TASK_STATUSES = ['Open', 'In Progress', 'Completed', 'Dismissed'] as const;

export class UpdateTaskStatusDto {
  @IsIn(TASK_STATUSES)
  status!: string;
}
