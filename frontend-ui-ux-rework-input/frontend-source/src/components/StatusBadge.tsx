import { Badge } from './ui/Badge';

export type StatusTone = 'danger' | 'success' | 'warning' | 'info' | 'purple' | 'cyan' | 'neutral';

const canonicalStatusTones: Record<string, StatusTone> = {
  active: 'success',
  accepted: 'success',
  approved: 'success',
  complete: 'success',
  completed: 'success',
  joined: 'success',
  hired: 'success',
  success: 'success',
  verified: 'success',
  normal: 'success',
  'offer accepted': 'success',
  'compliance cleared': 'success',
  draft: 'neutral',
  archived: 'neutral',
  inactive: 'neutral',
  'not reported': 'neutral',
  'not required': 'neutral',
  'on hold': 'neutral',
  pending: 'warning',
  'pending approval': 'warning',
  'pending joining': 'warning',
  'awaiting joining': 'warning',
  'awaiting documents': 'warning',
  'changes requested': 'warning',
  submitted: 'warning',
  postponed: 'warning',
  overdue: 'warning',
  medium: 'warning',
  'needs action': 'warning',
  'offer extended': 'info',
  applied: 'info',
  screening: 'info',
  assessment: 'purple',
  interview: 'purple',
  'interview scheduled': 'purple',
  scheduled: 'info',
  rescheduled: 'purple',
  evaluation: 'purple',
  scorecard: 'purple',
  offer: 'info',
  sent: 'info',
  open: 'info',
  'in progress': 'info',
  new: 'info',
  low: 'info',
  'talent pool': 'cyan',
  rejected: 'danger',
  declined: 'danger',
  cancelled: 'danger',
  withdrawn: 'danger',
  expired: 'danger',
  failed: 'danger',
  blocked: 'danger',
  blacklisted: 'danger',
  'no-show': 'danger',
  'offer declined': 'danger',
  high: 'danger',
  critical: 'danger',
};

export function getStatusTone(status: string): StatusTone {
  const normalized = status.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const exact = canonicalStatusTones[normalized];
  if (exact) return exact;
  if (/reject|declin|cancel|fail|block|withdraw|blacklist|expired/.test(normalized)) return 'danger';
  if (/approv|accept|join|complet|success|verif/.test(normalized)) return 'success';
  if (/pending|await|review|hold|overdue|warning|requested/.test(normalized)) return 'warning';
  if (/interview|scorecard|evaluation/.test(normalized)) return 'purple';
  if (/talent|benchmark/.test(normalized)) return 'cyan';
  if (/screen|offer|sent|progress|scheduled|applied/.test(normalized)) return 'info';
  return 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status);

  const dotClasses = {
    danger: 'bg-rf-danger',
    success: 'bg-rf-success',
    warning: 'bg-rf-warning',
    info: 'bg-rf-info',
    purple: 'bg-rf-purple',
    cyan: 'bg-rf-cyan',
    neutral: 'bg-rf-ink-muted',
  } as const;

  return (
    <Badge variant={tone}>
      <span className={['h-1.5 w-1.5 rounded-full', dotClasses[tone]].join(' ')} aria-hidden="true" />
      {status}
    </Badge>
  );
}
