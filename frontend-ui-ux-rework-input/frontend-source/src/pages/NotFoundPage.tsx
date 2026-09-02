import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function NotFoundPage() {
  return (
    <main className="rf-page-empty grid min-h-[72vh] place-items-center px-4 py-10 sm:px-6">
      <section className="rf-panel w-full max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-7 text-center shadow-xs sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm">
          <Icon name="search" size={22} />
        </div>

        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-600">Navigation error · 404</p>
        <h1 className="mt-2 text-[28px] font-black tracking-[-0.035em] text-slate-950 sm:text-[32px]">This workflow page moved.</h1>
        <p className="mx-auto mt-3 max-w-[420px] text-sm font-medium leading-6 text-slate-500">
          The page may have been removed, renamed, or moved to another recruitment workflow. Return to your command center to continue.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="primary" asChild>
            <Link to="/">
              <Icon name="dashboard" size={15} />
              Return to dashboard
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/tasks">
              <Icon name="check-circle" size={15} />
              Open my tasks
            </Link>
          </Button>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-5 text-[11px] font-medium text-slate-400">
          RecruitFlow keeps your hiring work organized by active workflow and permission scope.
        </div>
      </section>
    </main>
  );
}
