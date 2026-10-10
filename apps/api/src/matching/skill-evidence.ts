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

/** Whole-phrase, case-insensitive, whitespace-tolerant match; returns a snippet or null. */
export function findSkillSnippet(text: string | null | undefined, skillName: string, radius = 80): string | null {
  if (!text || !skillName.trim()) return null;
  const pattern = skillName.trim().split(/\s+/).map(escape).join('\\s+');
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[1]!.length;
  const end = start + m[2]!.length;
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const snippet = `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ').trim()}${to < text.length ? '…' : ''}`;
  return snippet.slice(0, 200);
}
