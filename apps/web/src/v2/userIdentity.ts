const HONORIFIC_PREFIX = /^(?:(?:dr|prof|eng|mr|mrs|ms)\.?\s+)+/i;
const JOB_TITLE_HINT = /\b(?:recruit(?:er|ment)|hiring|manager|mgr|director|nurs(?:e|ing)|hr|officer|specialist|coordinator|supervisor|administrator|consultant|lead|head|executive|talent|acquisition)\b/i;

export interface PersonIdentity {
  displayName: string;
  jobTitle: string | null;
}

function normalizeJobTitle(value: string): string {
  return value.replace(/\bhiring\s+mgr\b/i, 'Hiring Manager').trim();
}

export function splitPersonIdentity(fullName: string | null | undefined, jobTitle?: string | null): PersonIdentity {
  const rawName = (fullName ?? '').trim();
  const parenthetical = rawName.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const embeddedTitle = parenthetical && JOB_TITLE_HINT.test(parenthetical[2]) ? parenthetical[2].trim() : null;
  const displaySource = embeddedTitle && parenthetical ? parenthetical[1] : rawName;
  const displayName = displaySource.replace(HONORIFIC_PREFIX, '').replace(/\s+/g, ' ').trim();
  const title = embeddedTitle || jobTitle?.trim() || '';
  return { displayName, jobTitle: title ? normalizeJobTitle(title) : null };
}

export function formatPersonName(fullName: string | null | undefined): string {
  return splitPersonIdentity(fullName).displayName;
}

export function getInitials(fullName: string | null | undefined): string {
  const words = formatPersonName(fullName).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return '?';
  const first = Array.from(words[0]).find((character) => /[\p{L}\p{N}]/u.test(character)) ?? '';
  const last = words.length > 1
    ? Array.from(words[words.length - 1]).find((character) => /[\p{L}\p{N}]/u.test(character)) ?? ''
    : '';
  return `${first}${last}`.toLocaleUpperCase();
}

export const initials = getInitials;
