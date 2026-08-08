import type { ApplicationStage } from '@recruitflow/contracts';
import { Icon, type IconName } from './Icon';

interface PipelineStepperProps {
  currentStage: ApplicationStage | string;
  isRejectedOrWithdrawn?: boolean;
}

const PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];
const STAGE_ICONS: Record<string, IconName> = {
  Applied: 'document', Screening: 'users', Interview: 'calendar', Offer: 'offer', 'Pre-Hire': 'document', Joined: 'user-check',
};

export function PipelineStepper({ currentStage, isRejectedOrWithdrawn = false }: PipelineStepperProps) {
  const actualStage = PIPELINE_STAGES.includes(currentStage) ? currentStage : 'Applied';
  const currentIndex = PIPELINE_STAGES.indexOf(actualStage);
  const getStatus = (index: number) => {
    if (isRejectedOrWithdrawn && index === currentIndex) return 'rejected';
    if (isRejectedOrWithdrawn && index > currentIndex) return 'pending';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <section className={`pipeline-stepper ${isRejectedOrWithdrawn ? 'is-rejected' : ''}`} aria-label="Application pipeline progress">
      <div className="pipeline-stepper__ambient" aria-hidden="true" />
      <div className="pipeline-stepper__track" aria-hidden="true"><span style={{ width: `${(Math.max(0, currentIndex) / (PIPELINE_STAGES.length - 1)) * 100}%` }} /></div>
      <ol className="pipeline-stepper__list">
        {PIPELINE_STAGES.map((stage, index) => {
          const status = getStatus(index);
          const iconName = status === 'completed' ? 'check' : status === 'rejected' ? 'close' : STAGE_ICONS[stage] ?? 'check';
          return (
            <li className={`pipeline-stepper__item is-${status}`} key={stage} aria-current={status === 'current' ? 'step' : undefined}>
              <span className="pipeline-stepper__icon"><Icon name={iconName} size={16} /></span>
              <span className="pipeline-stepper__label">{stage}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
