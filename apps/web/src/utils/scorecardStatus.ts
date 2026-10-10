/**
 * B5: a scorecard's state comes only from its status (Draft | Submitted). The old `isLocked`
 * flag is going away and is never read. No card at all = 'missing'.
 */
export type ScorecardState = 'missing' | 'draft' | 'submitted';
type Card = object | null | undefined;

export function scorecardState(card: Card): ScorecardState {
  if (!card) return 'missing';
  return String((card as { status?: unknown }).status ?? '').toLowerCase() === 'submitted' ? 'submitted' : 'draft';
}
export const isScorecardSubmitted = (card: Card) => scorecardState(card) === 'submitted';
/** One interview round: submitted if any card is submitted, draft if any card exists, else missing. */
export function roundScorecardState(cards: ReadonlyArray<Card> | null | undefined): ScorecardState {
  if (!cards?.length) return 'missing';
  return cards.some(isScorecardSubmitted) ? 'submitted' : 'draft';
}
