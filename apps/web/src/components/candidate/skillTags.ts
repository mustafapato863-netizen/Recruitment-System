/**
 * Shared skill-chip ordering for compare / sourcing surfaces.
 * Priority (matched/required) skills surface first; remaining stay stable.
 */
export function normalizeSkillKey(skill: string): string {
  return skill.trim().toLowerCase();
}

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'job', 'role', 'senior', 'junior',
  'lead', 'officer', 'specialist', 'assistant', 'manager',
]);

export function inferPriorityFromTitle(title?: string | null): string[] {
  if (!title) return [];
  return title
    .split(/[^a-zA-Z0-9+#]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOPWORDS.has(part.toLowerCase()));
}

export function isSkillPrioritized(skill: string, prioritySkills: readonly string[]): boolean {
  const needle = normalizeSkillKey(skill);
  if (!needle || prioritySkills.length === 0) return false;
  for (const raw of prioritySkills) {
    const p = normalizeSkillKey(raw);
    if (!p) continue;
    if (needle === p || needle.includes(p) || p.includes(needle)) return true;
  }
  return false;
}

/** Stable: prioritized first, then the rest in original order (deduped). */
export function orderSkillsForDisplay(
  skills: readonly string[],
  prioritySkills: readonly string[] = [],
): string[] {
  const seen = new Set<string>();
  const first: string[] = [];
  const rest: string[] = [];
  for (const skill of skills) {
    const trimmed = skill?.trim();
    if (!trimmed) continue;
    const key = normalizeSkillKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isSkillPrioritized(trimmed, prioritySkills)) first.push(trimmed);
    else rest.push(trimmed);
  }
  return [...first, ...rest];
}

export function gradeForScore(score: number, hasVacancy: boolean): string {
  if (score >= 90) return 'High Match';
  if (score >= 80) return 'Good Match';
  if (score >= 60) return 'Fair Match';
  if (score >= 1) return 'Weak Match';
  return hasVacancy ? 'No position fit' : 'Select a position';
}
