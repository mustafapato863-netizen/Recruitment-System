import {
  isSkillPrioritized,
  orderSkillsForDisplay,
} from './skillTags';

export interface SkillTagsOverflowProps {
  skills: readonly string[];
  /** Matched / required skill names — shown first and (optionally) highlighted. */
  prioritySkills?: readonly string[];
  /** Max visible chips before +N overflow (default 6). */
  limit?: number;
  /** When true, priority skills get matched (green) styling. */
  highlightMatched?: boolean;
  className?: string;
}

export function SkillTagsOverflow({
  skills,
  prioritySkills = [],
  limit = 6,
  highlightMatched = true,
  className = '',
}: SkillTagsOverflowProps) {
  const ordered = orderSkillsForDisplay(skills, prioritySkills);
  const visible = ordered.slice(0, limit);
  const remaining = Math.max(0, ordered.length - visible.length);

  if (visible.length === 0) {
    return (
      <span className={`text-[10px] font-medium text-slate-400 ${className}`.trim()}>
        No skills recorded
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {visible.map((skill) => {
        const matched = highlightMatched && isSkillPrioritized(skill, prioritySkills);
        return (
          <span
            key={skill}
            className={
              matched
                ? 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-800'
                : 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40'
            }
          >
            {skill}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 self-center px-1">
          +{remaining}
        </span>
      )}
    </div>
  );
}
