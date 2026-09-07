import type { ApplicationStage } from '@recruitflow/contracts';
import { Icon, type IconName } from './Icon';

interface PipelineStepperProps {
  currentStage?: ApplicationStage | string;
  isRejectedOrWithdrawn?: boolean;
  steps?: string[];
  currentStep?: number;
  compact?: boolean;
}

const DEFAULT_PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];

const STAGE_ICONS: Record<string, IconName> = {
  Applied: 'document',
  Screening: 'users',
  Interview: 'calendar',
  Offer: 'offer',
  'Pre-Hire': 'document',
  Joined: 'user-check',
  Hired: 'user-check',
  Details: 'file-text',
  Compensation: 'offer',
  Review: 'check-circle',
  Upload: 'upload',
  Validate: 'check',
  Resolve: 'edit',
  Confirm: 'check-circle',
  // Streamlined 3-4 Step stages
  'Review & Sourcing': 'users',
  'Review & Screening': 'users',
  'Interview & Assessment': 'calendar',
  'Evaluation & Interview': 'calendar',
  'Offer & Compliance': 'offer',
  'Offer & Pre-Hire': 'offer',
  'Candidate & Role': 'users',
  'Compensation Package': 'offer',
  'Terms & Sign-Off': 'check-circle',
  'Terms & Approval': 'check-circle',
  'Role & Headcount': 'briefcase',
  'Requisition Basics': 'briefcase',
  'Parameters & Budget': 'file-text',
  'Requirements & Budget': 'file-text',
  'Review & Submit': 'check-circle',
  'Upload File': 'upload',
  'Upload Data': 'upload',
  'Validate & Resolve': 'check',
  'Confirm & Import': 'check-circle',
  'Application Received': 'document',
  'Final Decision & Joining': 'check-circle',
};

export function PipelineStepper({
  currentStage,
  isRejectedOrWithdrawn = false,
  steps,
  currentStep,
  compact = false,
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
      className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs mb-6 overflow-x-auto rf-pipeline-stepper-scroll"
      aria-label="Pipeline progress"
      role="region"
      tabIndex={0}
    >
      <div className={`relative px-4 py-2 rf-pipeline-stepper ${
        compact ? 'min-w-[320px]' : stageList.length <= 4 ? 'min-w-0 sm:min-w-[380px]' : 'min-w-[520px]'
      }`}>
        {/* Background track line */}
        <div className="absolute top-[26px] left-12 right-12 h-0.5 bg-slate-200 dark:bg-slate-800 rf-pipeline-stepper__track" aria-hidden="true" />

        {/* Active progress fill */}
        <div
          className="absolute top-[26px] left-12 h-0.5 bg-blue-600 dark:bg-blue-500 transition-all duration-300 rf-pipeline-stepper__progress"
          style={{ width: `calc((${progressPct} / 100) * (100% - 6rem))` }}
          aria-hidden="true"
        />

        <ol className="relative z-10 flex items-center justify-between list-none p-0 m-0 rf-pipeline-stepper__steps">
          {stageList.map((stage, index) => {
            const status = getStatus(index);
            const defaultIcon = STAGE_ICONS[stage] || 'circle';

            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';
            const isRejected = status === 'rejected';

            return (
              <li
                key={stage}
                className={`flex flex-col items-center gap-1.5 flex-1 text-center rf-pipeline-stepper__step is-${status}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-xs rf-pipeline-stepper__marker ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 shadow-blue-500/25'
                      : isRejected
                      ? 'bg-rose-600 text-white shadow-rose-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <Icon name="check" size={15} className="stroke-[2.5]" />
                  ) : isRejected ? (
                    <Icon name="close" size={14} className="stroke-[2.5]" />
                  ) : (
                    <Icon name={defaultIcon} size={15} />
                  )}
                </span>

                <span className={`text-xs font-bold leading-tight truncate max-w-[130px] rf-pipeline-stepper__label ${
                  isCurrent ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {stage}
                </span>
                <span className={`text-[10px] font-semibold rf-pipeline-stepper__meta ${
                  isCurrent ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  Step {index + 1}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
