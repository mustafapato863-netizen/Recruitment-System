import { useCallback, useEffect, type ReactNode } from 'react';
import { Link, useInRouterContext, useLocation } from 'react-router-dom';
import { ArrowLeft, Info, RotateCw, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  ButtonV2,
  EmptyStateV2,
  ErrorStateV2,
  ForbiddenStateV2,
  SkeletonV2,
} from '../../components/v2';
import {
  permittedAdminGroupItems,
  type AdminNavGroup,
} from '../../components/v2/shell/navConfig';

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return undefined;
  }
}

export interface AdminWorkspaceHeaderProps {
  group: AdminNavGroup;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backHref?: string | null;
  backLabel?: string;
}

function RouterSubnav({
  group,
  permissions,
  isAdministrator,
}: {
  group: AdminNavGroup;
  permissions: readonly string[] | undefined;
  isAdministrator: boolean;
}) {
  const location = useLocation();
  const items = permittedAdminGroupItems(group, permissions, isAdministrator);
  if (items.length <= 1) return null;

  return (
    <nav className="rf2-admin-subnav" aria-label={`${group} pages`}>
      <ul className="rf2-admin-subnav__list">
        {items.map((item) => {
          const active =
            location.pathname === item.to ||
            location.pathname.startsWith(`${item.to}/`);
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className="rf2-admin-subnav__link"
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Shared Admin workspace header and contextual group sub-navigation (ADM-03, ADM-04).
 * Reuses existing v2 primitives and tokens without introducing a parallel UI framework.
 */
export function AdminWorkspaceHeader({
  group,
  title,
  subtitle,
  actions,
  backHref,
  backLabel = 'Back',
}: AdminWorkspaceHeaderProps) {
  const inRouter = useInRouterContext();
  const auth = useSafeAuth();
  const user = auth?.user ?? null;
  const isAdministrator = (user?.roles ?? []).some(
    (role) => role.code === 'ADMINISTRATOR',
  );
  const permissions = user ? (user.permissions ?? []) : undefined;

  return (
    <header className="rf2-admin-header">
      {inRouter && backHref ? (
        <div className="rf2-admin-header__back-row">
          <Link to={backHref} className="rf2-admin-header__back">
            <ArrowLeft aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        </div>
      ) : null}
      <div className="rf2-row-between rf2-admin-header__top">
        <div className="rf2-admin-header__titles">
          <p className="rf2-admin-header__kicker">{group}</p>
          <h1 className="rf2-jobs__title">{title}</h1>
          {subtitle ? (
            <p className="rf2-admin-header__subtitle">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="rf2-admin-header__actions">{actions}</div>
        ) : null}
      </div>
      {inRouter ? (
        <RouterSubnav
          group={group}
          permissions={permissions}
          isAdministrator={isAdministrator}
        />
      ) : null}
    </header>
  );
}

export interface AdminFilterChip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface AdminToolbarV2Props {
  children?: ReactNode;
  secondaryActions?: ReactNode;
  chips?: readonly AdminFilterChip[];
  onClearAll?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  resultSummary?: string | null;
}

/**
 * Shared Admin filter/search toolbar with applied-filter chips, result summary, and clear/refresh actions.
 */
export function AdminToolbarV2({
  children,
  secondaryActions,
  chips = [],
  onClearAll,
  onRefresh,
  refreshing = false,
  resultSummary,
}: AdminToolbarV2Props) {
  return (
    <div className="rf2-admin-toolbar">
      <div className="rf2-row-between rf2-admin__filters">
        <div className="rf2-admin__filterset">{children}</div>
        <div className="rf2-admin-toolbar__end">
          {resultSummary ? (
            <span className="rf2-jtable__sub" aria-live="polite">
              {resultSummary}
            </span>
          ) : null}
          {onRefresh ? (
            <ButtonV2
              kind="secondary"
              size="sm"
              icon={<RotateCw />}
              loading={refreshing}
              onClick={onRefresh}
            >
              Refresh
            </ButtonV2>
          ) : null}
          {secondaryActions}
        </div>
      </div>
      {chips.length > 0 ? (
        <div className="rf2-admin-toolbar__chips" aria-label="Applied filters">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="rf2-admin-chip"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}: ${chip.value}`}
            >
              <span>
                {chip.label}: <strong>{chip.value}</strong>
              </span>
              <X aria-hidden="true" />
            </button>
          ))}
          {onClearAll ? (
            <ButtonV2 kind="tertiary" size="sm" onClick={onClearAll}>
              Clear filters
            </ButtonV2>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type AdminSectionState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'empty' }
  | { kind: 'filter-empty' }
  | { kind: 'forbidden'; title?: string; message?: string }
  | { kind: 'not-found'; title?: string; message?: string; backAction?: ReactNode }
  | { kind: 'unavailable'; message?: string }
  | { kind: 'error'; message: string };

export interface AdminSectionBoundaryProps<T> {
  state: AdminSectionState<T>;
  loadingLines?: number;
  loadingLabel?: string;
  headingLevel?: 2 | 3;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  emptyAction?: ReactNode;
  filterEmptyTitle?: string;
  filterEmptyBody?: ReactNode;
  onClearFilters?: () => void;
  errorTitle?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

/**
 * Standardized Admin section boundary composing existing v2 state primitives:
 * loading, ready, empty, filter-empty, forbidden (403), not-found (404), unavailable, and error + retry.
 */
export function AdminSectionBoundary<T>({
  state,
  loadingLines = 4,
  loadingLabel = 'Loading…',
  headingLevel = 2,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  emptyAction,
  filterEmptyTitle = 'No matching records',
  filterEmptyBody = 'Try adjusting or clearing your current search and filters.',
  onClearFilters,
  errorTitle = 'Could not load this section',
  onRetry,
  children,
}: AdminSectionBoundaryProps<T>) {
  switch (state.kind) {
    case 'loading':
      return <SkeletonV2 lines={loadingLines} label={loadingLabel} />;
    case 'empty':
      return (
        <EmptyStateV2
          headingLevel={headingLevel}
          title={emptyTitle}
          body={emptyBody}
          action={emptyAction}
        />
      );
    case 'filter-empty':
      return (
        <EmptyStateV2
          headingLevel={headingLevel}
          title={filterEmptyTitle}
          body={filterEmptyBody}
          action={
            onClearFilters ? (
              <ButtonV2 kind="secondary" size="sm" onClick={onClearFilters}>
                Clear filters
              </ButtonV2>
            ) : undefined
          }
        />
      );
    case 'forbidden':
      return (
        <ForbiddenStateV2
          headingLevel={headingLevel}
          title={state.title ?? 'You do not have access to this section'}
          body={
            state.message ??
            'Your current role does not include permission to view these records.'
          }
        />
      );
    case 'not-found':
      return (
        <EmptyStateV2
          headingLevel={headingLevel}
          title={state.title ?? 'Record not found'}
          body={
            state.message ??
            'The requested record does not exist or belongs to another organization.'
          }
          action={state.backAction}
        />
      );
    case 'unavailable':
      return (
        <p className="rf2-inline-note rf2-admin__pad" data-tone="warning" role="status">
          <Info aria-hidden="true" />{' '}
          {state.message ?? 'This capability is not available on this server yet.'}
        </p>
      );
    case 'error':
      return (
        <ErrorStateV2
          headingLevel={headingLevel}
          title={errorTitle}
          body={state.message}
          action={
            onRetry ? (
              <ButtonV2
                kind="secondary"
                size="sm"
                icon={<RotateCw />}
                onClick={onRetry}
              >
                Try again
              </ButtonV2>
            ) : undefined
          }
        />
      );
    case 'ready':
      return <>{children(state.data)}</>;
  }
}

/**
 * Dirty-form navigation and discard guard for Admin drawers and editors (ADM-04).
 */
export function useAdminUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const confirmDiscard = useCallback(
    (message = 'Discard unsaved changes?') => {
      if (!dirty) return true;
      if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
        return false;
      }
      return window.confirm(message);
    },
    [dirty],
  );

  return { dirty, confirmDiscard };
}
