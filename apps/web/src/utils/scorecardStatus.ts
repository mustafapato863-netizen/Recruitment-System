/**
 * A scorecard's state: B5 `status` (Draft | Submitted) when the API sends it; until B5 ships,
 * fall back to the legacy `isLocked` flag (locked = submitted). No card at all = 'missing'.
 */
export type ScorecardState = 'missing' | 'draft' | 'submitted';
type Card = object | null | undefined;

export function scorecardState(card: Card): ScorecardState {
  if (!card) return 'missing';
  const { status, isLocked } = card as { status?: unknown; isLocked?: unknown };
  if (typeof status === 'string' && status.trim()) return status.trim().toLowerCase() === 'submitted' ? 'submitted' : 'draft';
  return isLocked === true ? 'submitted' : 'draft';
}
export const isScorecardSubmitted = (card: Card) => scorecardState(card) === 'submitted';
/** One interview round: submitted if any card is submitted, draft if any card exists, else missing. */
export function roundScorecardState(cards: ReadonlyArray<Card> | null | undefined): ScorecardState {
  if (!cards?.length) return 'missing';
  return cards.some(isScorecardSubmitted) ? 'submitted' : 'draft';
}
