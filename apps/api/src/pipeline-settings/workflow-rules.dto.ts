import { IsIn, IsUUID } from 'class-validator';

export class WorkflowRuleDto {
  @IsUUID()
  positionId!: string;

  @IsIn(['technical', 'clinical'])
  profile!: 'technical' | 'clinical';
}
