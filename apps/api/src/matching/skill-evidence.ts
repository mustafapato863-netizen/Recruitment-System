/**
 * B6 evidence rules (v2 §7 "Suggest shows evidence or No evidence"; what counts
 * as evidence is open in v2, these are the defaults):
 *
 *  sourceType      | sourceRef               | counts as evidence when
 *  CV_TEXT         | candidate_documents.id  | the skill name appears as a whole phrase in the CV's extracted text
 *  SCREENING_NOTE  | screening_logs.id       | ... in a screening note
 *  SCORECARD       | interview_scorecards.id | ... in a scorecard's notes / strengths
 *  IMPORT          | candidate_import_rows.id| the skill was listed on an imported row
 *  MANUAL          | free (optional)         | a user adds it with a snippet (who + when recorded)
 *
 * A skill typed on the candidate profile (candidates.skills) is NOT evidence:
 * it shows as the skill with "No evidence" until one of the sources above exists.
 * Snippets are at most 200 characters around the match.
 */
export const EVIDENCE_SOURCE_TYPES = ['CV_TEXT', 'SCREENING_NOTE', 'SCORECARD', 'IMPORT', 'MANUAL'] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Clause-level cues. "ni" / "neither" cover the same guard as the validation helper plus those two forms. */
const NEGATION_CUE = /\b(?:no|not|never|without|lack|lacks|lacking|none|zero|ni|neither)\b/iu;

/** Text immediately before a match, staying inside the clause and within 40 characters. */
function clauseBefore(text: string, matchIndex: number): string {
  const windowStart = Math.max(0, matchIndex - 40);
  let start = windowStart;
  for (let i = matchIndex - 1; i >= windowStart; i -= 1) {
    const ch = text.charAt(i);
    if (ch === '.' || ch === ';' || ch === '\n' || ch === '!' || ch === '?') {
      start = i + 1;
      break;
    }
  }
  const slice = text.slice(start, matchIndex);
  const contrast = /\b(?:but|however)\b/giu;
  let cut = 0;
  for (const mark of slice.matchAll(contrast)) {
    cut = (mark.index ?? 0) + mark[0].length;
  }
  return slice.slice(cut);
}

function isNegatedAt(text: string, matchIndex: number): boolean {
  return NEGATION_CUE.test(clauseBefore(text, matchIndex));
}

/** Whole-phrase, case-insensitive, whitespace-tolerant match; returns a snippet or null. Negated mentions are skipped. */
export function findSkillSnippet(text: string | null | undefined, skillName: string, radius = 80): string | null {
  if (!text || !skillName.trim()) return null;
  const pattern = skillName.trim().split(/\s+/).map(escape).join('\\s+');
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const prefix = match[1] ?? '';
    const body = match[2];
    if (!body) {
      if (re.lastIndex === match.index) re.lastIndex += 1;
      continue;
    }
    const start = match.index + prefix.length;
    const end = start + body.length;
    if (isNegatedAt(text, start)) {
      if (re.lastIndex === match.index) re.lastIndex += 1;
      continue;
    }
    const from = Math.max(0, start - radius);
    const to = Math.min(text.length, end + radius);
    const snippet = `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ').trim()}${to < text.length ? '…' : ''}`;
    return snippet.slice(0, 200);
  }
  return null;
}
