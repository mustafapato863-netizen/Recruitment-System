import type { ComponentProps } from 'react';
import { Avatar, Badge, Button, SLAIndicator } from '../ui';
import { PipelineStepper } from '../PipelineStepper';
import { SkillTagsOverflow } from './SkillTagsOverflow';
import { inferPriorityFromTitle } from './skillTags';

export interface CandidateWorkspaceProps {
  candidateName: string;
  positionTitle: string | null;
  applicationId: string | null;
  stage: string | null;
  stages: string[];
  slaDeadline: string | null;
  tags: string[];
  email: string | null;
  phone: string | null;
  location: string | null;
  onAddTag?: () => void;
}

type SLAIndicatorStatus = ComponentProps<typeof SLAIndicator>['status'];

function formatApplicationId(rawId: string | null): string | null {
  if (!rawId) return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const cleanId = trimmed.replace(/^app[-_]?/i, '');
  const target = cleanId || trimmed;
  const slice = target.slice(0, 8).toUpperCase();
  return slice ? `APP-${slice}` : null;
}

function getInitials(name: string): string {
  if (!name) return 'CP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getSlaProps(deadline: string): ComponentProps<typeof SLAIndicator> {
  const trimmed = deadline.trim();
  const normalized = trimmed.toLowerCase().replace(/[\s-]/g, '_');

  if (
    normalized === 'on_track' ||
    normalized === 'at_risk' ||
    normalized === 'breached' ||
    normalized === 'completed'
  ) {
    return { status: normalized as SLAIndicatorStatus };
  }

  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed !== '') {
    if (asNumber < 0) {
      return { status: 'breached', daysRemaining: Math.abs(asNumber), label: 'SLA Breached' };
    }
    if (asNumber <= 2) {
      return { status: 'at_risk', daysRemaining: asNumber };
    }
    return { status: 'on_track', daysRemaining: asNumber };
  }

  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const diffMs = parsedDate - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) {
      return { status: 'breached', daysRemaining: Math.abs(days), label: 'SLA Breached' };
    }
    if (days <= 2) {
      return { status: 'at_risk', daysRemaining: Math.max(0, days) };
    }
    return { status: 'on_track', daysRemaining: days };
  }

  return { status: 'on_track', label: trimmed };
}

export function CandidateWorkspace({
  candidateName,
  positionTitle,
  applicationId,
  stage,
  stages,
  slaDeadline,
  tags,
  email,
  phone,
  location,
  onAddTag,
}: CandidateWorkspaceProps) {
  const initials = getInitials(candidateName);
  const formattedAppId = formatApplicationId(applicationId);

  const hasPosition = Boolean(positionTitle?.trim());
  const hasAppId = Boolean(formattedAppId);
  const hasRoleOrApp = hasPosition || hasAppId;

  const contactItems: string[] = [];
  if (location?.trim()) contactItems.push(location.trim());
  if (email?.trim()) contactItems.push(email.trim());
  if (phone?.trim()) contactItems.push(phone.trim());

  const hasStageRail = Boolean(stage?.trim() && stages && stages.length > 0);

  return (
    <header className="candidate-workspace w-full bg-rf-surface border border-rf-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex items-start gap-3.5">
        <Avatar
          initials={initials}
          size="md"
          aria-hidden="true"
          className="w-10 h-10 min-w-10 min-h-10 text-sm shrink-0"
          style={{ width: 40, height: 40 }}
        />

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-base sm:text-lg font-bold text-rf-ink truncate leading-tight">
              {candidateName}
            </p>
            {slaDeadline && <SLAIndicator {...getSlaProps(slaDeadline)} />}
          </div>

          {hasRoleOrApp && (
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-rf-ink-muted">
              {hasPosition && <span>{positionTitle!.trim()}</span>}
              {hasPosition && hasAppId && (
                <span aria-hidden="true" className="text-rf-border-strong select-none">
                  -
                </span>
              )}
              {hasAppId && (
                <Badge variant="neutral" className="font-mono text-[10.5px]">
                  {formattedAppId}
                </Badge>
              )}
            </div>
          )}

          {contactItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-rf-ink-muted">
              {contactItems.map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-x-2">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-rf-border-strong select-none">
                      -
                    </span>
                  )}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-xs font-semibold text-rf-ink-muted">Skills:</span>
            <div aria-label="Best-fit skills" className="min-w-0 flex-1">
              <SkillTagsOverflow
                skills={tags ?? []}
                prioritySkills={inferPriorityFromTitle(positionTitle)}
                limit={6}
                bestFitOnly
              />
            </div>
            {onAddTag && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onAddTag}
                className="h-6 min-h-6 px-2 text-[11px] font-medium"
                aria-label="Add tag"
              >
                + Add
              </Button>
            )}
          </div>
        </div>
      </div>

      {hasStageRail && (
        <div className="pt-2 border-t border-rf-border-subtle [&_.rf-pipeline-stepper-scroll]:mb-0 [&_.rf-pipeline-stepper-scroll]:border-0 [&_.rf-pipeline-stepper-scroll]:shadow-none [&_.rf-pipeline-stepper-scroll]:p-0 [&_.rf-pipeline-stepper-scroll]:bg-transparent">
          <PipelineStepper currentStage={stage!} steps={stages} />
        </div>
      )}
    </header>
  );
}
