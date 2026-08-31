import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';

export interface ScorecardCriterion {
  id: string;
  name: string;
  rating?: number;
  comment?: string;
}

export interface ScorecardCategory {
  id: string;
  name: string;
  isComplete?: boolean;
  isRequired?: boolean;
  criteria: ScorecardCriterion[];
}

export type Recommendation = 'strong_hire' | 'hire' | 'no_hire';

interface ScorecardProps {
  title: string;
  interviewer: string;
  dueText?: string;
  categories: ScorecardCategory[];
  recommendation?: Recommendation;
  onRatingChange?: (categoryId: string, criterionId: string, rating: number) => void;
  onRecommendationChange?: (recommendation: Recommendation) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  headerBadge?: ReactNode;
}

export function Scorecard({
  title,
  interviewer,
  dueText,
  categories,
  recommendation,
  onRatingChange,
  onRecommendationChange,
  onSubmit,
  submitLabel = 'Save feedback',
  headerBadge,
}: ScorecardProps) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    categories.reduce((acc, cat, index) => ({ ...acc, [cat.id]: index === 0 }), {})
  );

  const toggleCategory = (id: string) => {
    setOpenCategories((curr) => ({ ...curr, [id]: !curr[id] }));
  };

  const handleRatingKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    categoryId: string,
    criterionId: string,
    rating: number,
  ) => {
    const nextRating = event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? Math.min(5, rating + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? Math.max(1, rating - 1)
        : event.key === 'Home'
          ? 1
          : event.key === 'End'
            ? 5
            : null;
    if (nextRating === null) return;
    event.preventDefault();
    onRatingChange?.(categoryId, criterionId, nextRating);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-rating="${nextRating}"]`)?.focus();
  };

  return (
    <form
      className="scorecard-demo"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="scorecard-heading">
        <div>
          <b>{title}</b>
          <small>
            Interviewer: {interviewer} {dueText ? `· ${dueText}` : ''}
          </small>
        </div>
        {headerBadge || <Badge variant="warning">Scorecard</Badge>}
      </div>

      {categories.map((cat) => {
        const isOpen = openCategories[cat.id] ?? false;
        return (
          <div key={cat.id} className="scorecard-category">
            <button
              className="accordion-trigger"
              type="button"
              aria-expanded={isOpen}
              aria-controls={`scorecard-category-${cat.id}`}
              onClick={() => toggleCategory(cat.id)}
            >
              <span>{cat.name}</span>
              {cat.isComplete ? (
                <Badge variant="success">Complete</Badge>
              ) : cat.isRequired ? (
                <Badge variant="danger">Required</Badge>
              ) : null}
            </button>

            {isOpen && (
              <div id={`scorecard-category-${cat.id}`} className="scorecard-category-body" role="region" aria-label={`${cat.name} criteria`}>
                {cat.criteria.map((crit) => (
                  <div key={crit.id} className="score-row">
                    <span>{crit.name}</span>
                    <div
                      className="rating-scale"
                      role="radiogroup"
                      aria-label={`${crit.name} rating`}
                    >
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          role="radio"
                          data-rating={num}
                          aria-checked={crit.rating === num}
                          tabIndex={crit.rating === num || (crit.rating === undefined && num === 1) ? 0 : -1}
                          className={crit.rating === num ? 'selected' : ''}
                          onClick={() => onRatingChange?.(cat.id, crit.id, num)}
                          onKeyDown={(event) => handleRatingKeyDown(event, cat.id, crit.id, num)}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="recommendation-group" role="group" aria-label="Overall recommendation">
        <b>Overall recommendation</b>
        <div>
          <button
            className={`recommendation-option ${recommendation === 'no_hire' ? 'selected' : ''}`}
            type="button"
            aria-pressed={recommendation === 'no_hire'}
            onClick={() => onRecommendationChange?.('no_hire')}
          >
            No hire
          </button>
          <button
            className={`recommendation-option ${recommendation === 'strong_hire' ? 'selected' : ''}`}
            type="button"
            aria-pressed={recommendation === 'strong_hire'}
            onClick={() => onRecommendationChange?.('strong_hire')}
          >
            Strong hire
          </button>
          <button
            className={`recommendation-option ${recommendation === 'hire' ? 'selected' : ''}`}
            type="button"
            aria-pressed={recommendation === 'hire'}
            onClick={() => onRecommendationChange?.('hire')}
          >
            Hire
          </button>
        </div>
      </div>

      <Button variant="primary" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
