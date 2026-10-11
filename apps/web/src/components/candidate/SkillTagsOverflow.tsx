import { useMemo, useState } from 'react';
import {
  isSkillPrioritized,
  orderSkillsForDisplay,
} from './skillTags';

export interface SkillTagsOverflowProps {
  skills: readonly string[];
  /** Matched / required skill names — shown first and highlighted. */
  prioritySkills?: readonly string[];
  /** Max visible chips before +N overflow (default 6). */
  limit?: number;
  /** When true, priority skills get matched (green) styling. */
  highlightMatched?: boolean;
  /** Prefer only matched skills in the visible row; others collapse into +N. */
  bestFitOnly?: boolean;
  className?: string;
}

export function SkillTagsOverflow({
  skills,
  prioritySkills = [],
  limit = 6,
  highlightMatched = true,
  bestFitOnly = true,
  className = '',
}: SkillTagsOverflowProps) {
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(
    () => orderSkillsForDisplay(skills, prioritySkills),
    [skills, prioritySkills],
  );
  const matched = useMemo(
    () => ordered.filter((skill) => isSkillPrioritized(skill, prioritySkills)),
    [ordered, prioritySkills],
  );

  const preferred = bestFitOnly && matched.length > 0 ? matched : ordered;
  const visible = expanded ? ordered : preferred.slice(0, limit);
  const remaining = Math.max(0, ordered.length - visible.length);

  if (ordered.length === 0) {
    return (
      <span className={`text-[10px] font-medium text-rf-ink-muted ${className}`.trim()}>
        No skills recorded
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {visible.map((skill) => {
        const matchedSkill = highlightMatched && isSkillPrioritized(skill, prioritySkills);
        return (
          <span
            key={skill}
            title={matchedSkill ? 'Best fit for this role' : skill}
            className={
              matchedSkill
                ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200'
            }
          >
            {skill}
          </span>
        );
      })}
      {remaining > 0 && (
        <button
          type="button"
          className="text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 hover:bg-slate-200"
          title={`Show ${remaining} more skills`}
          onClick={() => setExpanded(true)}
        >
          +{remaining}
        </button>
      )}
      {expanded && ordered.length > limit && (
        <button
          type="button"
          className="text-[10px] font-bold text-slate-500 underline underline-offset-2"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      )}
    </div>
  );
}
