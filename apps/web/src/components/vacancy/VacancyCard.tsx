import type { KeyboardEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export interface VacancyCardData {
  id: string;
  title: string;
  vacancyCode?: string;
  positionCode?: string;
  department: string;
  location: string;
  status: string;
  minExperienceYears?: number | null;
  workType?: string;
}

export interface VacancyRoleAppearance {
  icon: IconName;
  tileClassName: string;
  skillClassName: string;
}

const roleAppearances: Array<{ match: RegExp; appearance: VacancyRoleAppearance }> = [
  {
    match: /pharmac|pharmacy|dispens|drug/i,
    appearance: {
      icon: 'pill',
      tileClassName: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
      skillClassName: 'border-violet-100 bg-violet-50/80 text-violet-800 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-200',
    },
  },
  {
    match: /laborator|\blab\b|patholog|radiolog|research|microscop/i,
    appearance: {
      icon: 'microscope',
      tileClassName: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-900/60',
      skillClassName: 'border-cyan-100 bg-cyan-50/80 text-cyan-900 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-200',
    },
  },
  {
    match: /nurs|doctor|physician|clinical|medical|surgeon|cardio|icu|therapist|dentist|healthcare/i,
    appearance: {
      icon: 'stethoscope',
      tileClassName: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900/60',
      skillClassName: 'border-teal-100 bg-teal-50/80 text-teal-900 dark:border-teal-900/70 dark:bg-teal-950/30 dark:text-teal-200',
    },
  },
  {
    match: /software|developer|programmer|engineer|\bit\b|technology|data analyst|data engineer|cyber|product designer/i,
    appearance: {
      icon: 'code',
      tileClassName: 'bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
      skillClassName: 'border-blue-100 bg-blue-50/80 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200',
    },
  },
  {
    match: /market|sales|media|advertis|brand|communication|content|public relation/i,
    appearance: {
      icon: 'megaphone',
      tileClassName: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60',
      skillClassName: 'border-indigo-100 bg-indigo-50/80 text-indigo-800 dark:border-indigo-900/70 dark:bg-indigo-950/30 dark:text-indigo-200',
    },
  },
  {
    match: /finance|account|payroll|treasury|budget|auditor/i,
    appearance: {
      icon: 'calculator',
      tileClassName: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
      skillClassName: 'border-amber-100 bg-amber-50/80 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200',
    },
  },
  {
    match: /human resource|\bhr\b|recruit|talent|people partner/i,
    appearance: {
      icon: 'users',
      tileClassName: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
      skillClassName: 'border-emerald-100 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200',
    },
  },
  {
    match: /legal|lawyer|attorney|compliance|governance|risk manager/i,
    appearance: {
      icon: 'scale',
      tileClassName: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
      skillClassName: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    },
  },
  {
    match: /operation|administrat|procurement|facilit|office manager|coordinator/i,
    appearance: {
      icon: 'building',
      tileClassName: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
      skillClassName: 'border-orange-100 bg-orange-50/80 text-orange-900 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200',
    },
  },
];

const defaultRoleAppearance: VacancyRoleAppearance = {
  icon: 'briefcase',
  tileClassName: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  skillClassName: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

export function getVacancyRoleAppearance(
  vacancy: Pick<VacancyCardData, 'title' | 'department'>,
  iconOverride?: IconName,
): VacancyRoleAppearance {
  if (iconOverride) {
    const matchedAppearance = roleAppearances.find(({ appearance }) => appearance.icon === iconOverride)?.appearance;
    return { ...(matchedAppearance ?? defaultRoleAppearance), icon: iconOverride };
  }

  const roleTitleAppearance = roleAppearances.find(({ match }) => match.test(vacancy.title))?.appearance;
  const departmentAppearance = roleAppearances.find(({ match }) => match.test(vacancy.department))?.appearance;
  return roleTitleAppearance ?? departmentAppearance ?? defaultRoleAppearance;
}

function getStatusAppearance(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === 'open' || normalizedStatus === 'filled') {
    return {
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    };
  }
  if (normalizedStatus === 'pending activation' || normalizedStatus === 'pending approval') {
    return {
      badge: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      dot: 'bg-amber-500',
    };
  }
  if (normalizedStatus === 'partially filled') {
    return {
      badge: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
      dot: 'bg-blue-500',
    };
  }
  return {
    badge: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  };
}

export function VacancyCard({
  vacancy,
  children,
  footer,
  onOpen,
  roleIcon,
  className = '',
}: {
  vacancy: VacancyCardData;
  children?: ReactNode;
  footer?: ReactNode;
  onOpen?: () => void;
  roleIcon?: IconName;
  className?: string;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onOpen || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      role={onOpen ? 'group' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Vacancy ${vacancy.title}. Press Enter to view details.` : undefined}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={`group flex min-w-0 flex-col rounded-xl border border-slate-200/90 bg-white p-[8px] shadow-sm transition duration-200 hover:border-blue-200 hover:shadow-lg motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 ${onOpen ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950' : ''} ${className}`}
    >
      <VacancyCardHeader vacancy={vacancy} roleIcon={roleIcon} />
      {children}
      {footer && <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800">{footer}</div>}
    </article>
  );
}

export function VacancyCardHeader({
  vacancy,
  roleIcon,
}: {
  vacancy: VacancyCardData;
  roleIcon?: IconName;
}) {
  const appearance = getVacancyRoleAppearance(vacancy, roleIcon);
  const statusAppearance = getStatusAppearance(vacancy.status);

  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${appearance.tileClassName}`}>
        <Icon name={appearance.icon} size={19} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
          <span>{vacancy.positionCode || vacancy.vacancyCode || 'Vacancy'}</span>
          <span className="px-1 text-slate-300" aria-hidden="true">·</span>
          <span>{vacancy.department}</span>
        </p>
        <h3 className="mt-1 break-words text-base font-bold leading-snug text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
          {vacancy.title}
        </h3>
      </div>
      <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${statusAppearance.badge}`}>
        <span className={`h-2 w-2 rounded-full ${statusAppearance.dot}`} aria-hidden="true" />
        {vacancy.status}
      </span>
    </div>
  );
}

export function VacancyCardMeta({
  location,
  experienceLabel,
  workType,
}: {
  location?: string;
  experienceLabel?: string;
  workType?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {experienceLabel && (
        <span className="inline-flex items-center gap-2">
          <Icon name="briefcase" size={16} className="text-slate-400" aria-hidden="true" />
          {experienceLabel}
        </span>
      )}
      {workType && (
        <span className="inline-flex items-center gap-2">
          <Icon name="briefcase" size={16} className="text-slate-400" aria-hidden="true" />
          {workType}
        </span>
      )}
      {location && (
        <span className="inline-flex items-center gap-2">
          <Icon name="map-pin" size={16} className="text-slate-400" aria-hidden="true" />
          {location}
        </span>
      )}
    </div>
  );
}

export interface VacancyCardMetricItem {
  key: string;
  label: string;
  value: ReactNode;
  icon?: IconName;
}

export function VacancyCardMetrics({ items }: { items: VacancyCardMetricItem[] }) {
  if (items.length === 0) return null;

  const columns = items.length === 2 ? 'grid-cols-2' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className={`grid ${columns} gap-2`}>
      {items.map((item) => (
        <div key={item.key} className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
          <span className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
            {item.icon && <Icon name={item.icon} size={12} aria-hidden="true" />}
            {item.label}
          </span>
          <div className="mt-1 min-w-0 text-sm font-bold leading-tight text-slate-900 dark:text-white">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function VacancyCardHeadcountProgress({
  filled,
  target,
  label = 'Headcount filled',
}: {
  filled: number;
  target: number;
  label?: string;
}) {
  const percentage = target > 0 ? Math.max(0, Math.min(100, Math.round((filled / target) * 100))) : 0;
  const barColor = percentage >= 100 ? 'bg-emerald-500' : percentage > 50 ? 'bg-blue-600' : 'bg-amber-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">
          {filled} / {target > 0 ? target : '—'} <span className="font-medium text-slate-500">({percentage}%)</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target || 1}
        aria-valuenow={target > 0 ? Math.max(0, Math.min(target, filled)) : 0}
        aria-valuetext={`${percentage}% filled`}
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${barColor}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function VacancyCardSkills({
  vacancy,
  skills,
  maxVisible = 3,
  showWhenEmpty = false,
}: {
  vacancy: Pick<VacancyCardData, 'title' | 'department'>;
  skills: string[];
  maxVisible?: number;
  showWhenEmpty?: boolean;
}) {
  if (skills.length === 0 && !showWhenEmpty) return null;
  const appearance = getVacancyRoleAppearance(vacancy);

  return (
    <section aria-label="Key skills">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Key skills</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {skills.length > 0 ? skills.slice(0, maxVisible).map((skill) => (
          <span key={skill} className={`inline-flex min-h-6 max-w-full items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 ${appearance.skillClassName}`}>
            <span className="break-words">{skill}</span>
          </span>
        )) : <span className="py-1 text-xs text-slate-400">No skills specified</span>}
        {skills.length > maxVisible && (
          <span className="inline-flex min-h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            +{skills.length - maxVisible} more
          </span>
        )}
      </div>
    </section>
  );
}

export function VacancyCardEducation({ qualifications }: { qualifications?: string | null }) {
  return (
    <section className="flex items-start gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon name="graduation-cap" size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Education</h4>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
          {qualifications || 'Education requirements not specified.'}
        </p>
      </div>
    </section>
  );
}
