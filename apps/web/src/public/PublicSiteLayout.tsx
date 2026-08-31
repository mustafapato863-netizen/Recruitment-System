import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function PublicSiteLayout({
  organizationCode,
  organizationName,
  children,
}: {
  organizationCode: string;
  organizationName?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-rf-canvas text-rf-ink">
      <header className="border-b border-rf-border-subtle bg-rf-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to={`/careers/${encodeURIComponent(organizationCode)}/jobs`}
            className="flex min-h-10 items-center gap-2.5 no-underline"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-rf-action text-rf-on-action shadow-[var(--shadow-xs)]" aria-hidden="true">
              <Icon name="briefcase" size={17} />
            </span>
            <span className="min-w-0">
              <strong className="block truncate font-rf-heading text-sm font-extrabold tracking-tight text-rf-ink">
                {organizationName || 'Career site'}
              </strong>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-rf-ink-muted">
                Open opportunities
              </span>
            </span>
          </Link>
          <span className="hidden text-[11px] font-semibold text-rf-ink-muted sm:block">
            Powered by RecruitFlow
          </span>
        </div>
      </header>
      {children}
      <footer className="border-t border-rf-border-subtle bg-rf-surface/70">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-1 px-4 py-6 text-[10px] font-medium text-rf-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>RecruitFlow candidate application portal</span>
          <span>Your information is handled by the hiring organization.</span>
        </div>
      </footer>
    </div>
  );
}
