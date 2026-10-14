import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class WorkflowRuleDto {
  @IsUUID()
  positionId!: string;

  @IsIn(['technical', 'clinical'])
  profile!: 'technical' | 'clinical';
}

/** Apply requires a reason. Preview keeps WorkflowRuleDto so a preview can run without one. */
export const WORKFLOW_RULE_REASON_MAX = 500;

export class ApplyWorkflowRuleDto extends WorkflowRuleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Enter a reason for this rule change.' })
  @MaxLength(WORKFLOW_RULE_REASON_MAX, { message: 'The reason is too long.' })
  reason!: string;
}
