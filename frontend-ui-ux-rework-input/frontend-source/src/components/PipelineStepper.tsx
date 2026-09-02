import type { ApplicationStage } from '@recruitflow/contracts';
import { Icon, type IconName } from './Icon';

interface PipelineStepperProps {
  currentStage?: ApplicationStage | string;
  isRejectedOrWithdrawn?: boolean;
  steps?: string[];
  currentStep?: number;
}

const DEFAULT_PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];

const STAGE_ICONS: Record<string, IconName> = {
  Applied: 'document',
  Screening: 'users',
  Interview: 'calendar',
  Offer: 'offer',
  'Pre-Hire': 'document',
  Joined: 'user-check',
  Details: 'file-text',
  Compensation: 'offer',
  Review: 'check-circle',
  Upload: 'upload',
  Validate: 'check',
  Resolve: 'edit',
  Confirm: 'check-circle',
};

export function PipelineStepper({
  currentStage,
  isRejectedOrWithdrawn = false,
  steps,
  currentStep,
}: PipelineStepperProps) {
  const stageList = steps && steps.length > 0 ? steps : DEFAULT_PIPELINE_STAGES;
  let currentIndex = 0;

  if (typeof currentStep === 'number') {
    currentIndex = currentStep;
  } else if (currentStage) {
    const idx = stageList.indexOf(currentStage);
    currentIndex = idx >= 0 ? idx : 0;
  }

  const getStatus = (index: number) => {
    if (isRejectedOrWithdrawn && index === currentIndex) return 'rejected';
    if (isRejectedOrWithdrawn && index > currentIndex) return 'pending';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  const progressPct = stageList.length > 1
    ? (Math.max(0, currentIndex) / (stageList.length - 1)) * 100
    : 0;

  return (
    <div
      className="rf-pipeline-stepper-scroll rf-scrollbar"
      aria-label="Pipeline progress"
      role="region"
      tabIndex={0}
    >
      <div className="rf-pipeline-stepper">
        <div className="rf-pipeline-stepper__track" aria-hidden="true" />
        <div
          className="rf-pipeline-stepper__progress"
          style={{ width: progressPct === 0 ? '0%' : `${progressPct}%` }}
          aria-hidden="true"
        />

        <ol className="rf-pipeline-stepper__steps">
          {stageList.map((stage, index) => {
            const status = getStatus(index);
            const defaultIcon = STAGE_ICONS[stage] || 'circle';

            return (
              <li
                key={stage}
                className={`rf-pipeline-stepper__step is-${status}`}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className="rf-pipeline-stepper__marker" aria-hidden="true">
                  {status === 'completed' ? (
                    <Icon name="check" size={14} className="stroke-[2.5]" />
                  ) : status === 'rejected' ? (
                    <Icon name="close" size={13} className="stroke-[2.5]" />
                  ) : (
                    <Icon name={defaultIcon} size={14} />
                  )}
                </span>

                <span className="rf-pipeline-stepper__label">{stage}</span>
                <span className="rf-pipeline-stepper__meta">Step {index + 1}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
