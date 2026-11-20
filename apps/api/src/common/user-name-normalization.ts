export interface NormalizedUserIdentity {
  displayName: string;
  jobTitle: string | null;
}

const HONORIFIC_PREFIXES = [
  'Prof.', 'Professor', 'Dr.', 'Doctor', 'Mr.', 'Mrs.', 'Ms.', 'Mx.',
  'Eng.', 'Engineer', 'Hon.', 'Honorable',
];

const ABBREVIATIONS: Record<string, string> = {
  'Hiring Mgr': 'Hiring Manager',
  'HR Mgr': 'HR Manager',
  'Recruitment Mgr': 'Recruitment Manager',
  'Sr': 'Senior',
  'Sr.': 'Senior',
  'Jr': 'Junior',
  'Jr.': 'Junior',
};
const JOB_TITLE_HINT = /\b(?:recruit(?:er|ment)|hiring|manager|mgr|director|nurs(?:e|ing)|hr|officer|specialist|coordinator|supervisor|administrator|consultant|lead|head|executive|talent|acquisition)\b/i;

function expandAbbreviations(value: string): string {
  let result = value.trim();
  for (const [abbreviation, expansion] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbreviation.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi'), expansion);
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function normalizeUserIdentity(displayName: string, explicitJobTitle?: string | null): NormalizedUserIdentity {
  let name = (displayName ?? '').trim();
  let extractedTitle: string | null = null;

  const trailingRole = name.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (trailingRole && JOB_TITLE_HINT.test(trailingRole[2] ?? '')) {
    name = (trailingRole[1] ?? '').trim();
    extractedTitle = (trailingRole[2] ?? '').trim();
  }

  for (const honorific of [...HONORIFIC_PREFIXES].sort((a, b) => b.length - a.length)) {
    const prefix = new RegExp(`^${honorific.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s+`, 'i');
    if (prefix.test(name)) {
      name = name.replace(prefix, '').trim();
      break;
    }
  }

  const jobTitle = extractedTitle
    ? expandAbbreviations(extractedTitle)
    : explicitJobTitle?.trim()
      ? expandAbbreviations(explicitJobTitle.trim())
      : null;

  return { displayName: name, jobTitle };
}
