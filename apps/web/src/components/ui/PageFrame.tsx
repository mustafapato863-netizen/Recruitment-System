import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { OverflowMenu } from './OverflowMenu';
import { useMediaQuery } from './useMediaQuery';

function flattenChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return flattenChildren(child.props.children);
    }
    return child;
  });
}

interface PageFrameProps {
  eyebrow?: string;
  title: ReactNode;
  titleBadge?: ReactNode;
  leadingVisual?: ReactNode;
  topNav?: ReactNode;
  description?: string;
  actions?: ReactNode;
  /**
   * Action kept inline below the sm breakpoint. When omitted, the first
   * ctions child is the primary action.
   */
  primaryAction?: ReactNode;
  /**
   * Actions placed in the More menu below sm. When omitted, every ctions
   * child after the primary action is used.
   */
  overflowActions?: ReactNode;
  children: ReactNode;
  className?: string;
  showBack?: boolean;
  backTo?: string;
}

export function PageFrame({
  eyebrow,
  title,
  titleBadge,
  leadingVisual,
  topNav,
  description,
  actions,
  primaryAction,
  overflowActions,
  children,
  className = '',
  showBack = false,
  backTo,
}: PageFrameProps) {
  const compact = useMediaQuery('(max-width: 639px)');
  const actionItems = flattenChildren(actions);
  const hasActions = Boolean(primaryAction) || actionItems.length > 0 || Boolean(overflowActions);

  const inlineAction = primaryAction ?? actionItems[0];
  const menuActions = overflowActions ?? (primaryAction ? actions : actionItems.slice(1));
  const menuCount = flattenChildren(menuActions).length;

  return (
    <div className={['page rf-page relative z-[1] mx-auto flex w-full max-w-[var(--rf-page-max)] flex-col gap-3.5 px-3.5 py-4 sm:px-5 lg:px-6 lg:py-5', className].filter(Boolean).join(' ')}>
      <header className="rf-page-header flex flex-col items-stretch justify-between gap-2.5 border-b border-rf-border-subtle pb-3.5 md:flex-row md:flex-wrap md:items-center md:gap-5">
        <div className="min-w-0">
          {showBack && backTo && (
            <Link
              to={backTo}
              className="mb-2 inline-flex min-h-7 items-center gap-1.5 rounded-md text-xs font-semibold text-rf-action no-underline transition-colors hover:text-rf-action-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/30"
            >
              <Icon name="arrow-left" size={14} />
              Back
            </Link>
          )}
          {topNav}
          {eyebrow && <div className="rf-page-eyebrow mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-rf-ink-muted">{eyebrow}</div>}
          <div className="rf-page-identity">
            {leadingVisual}
            <div className="min-w-0">
              <div className="rf-page-title-row">
                <h1 className="rf-page-title">{title}</h1>
                {titleBadge}
              </div>
              {description && <p className="m-0 mt-1 max-w-[860px] text-xs font-medium leading-5 text-rf-ink-muted">{description}</p>}
            </div>
          </div>
        </div>
        {hasActions && (
          <div className="rf-page-actions flex w-full min-w-0 flex-wrap items-center gap-2.5 md:w-auto md:shrink-0 md:justify-end">
            {compact ? (
              <>
                {inlineAction}
                {menuCount > 0 && <OverflowMenu label="More">{menuActions}</OverflowMenu>}
              </>
            ) : (
              <>
                {primaryAction}
                {actions}
                {overflowActions}
              </>
            )}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}