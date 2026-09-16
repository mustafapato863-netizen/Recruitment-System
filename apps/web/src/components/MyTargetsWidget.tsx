import { useEffect, useState } from 'react';
import type { RecruiterTargetProgressRecord } from '@recruitflow/contracts';
import { getApi } from '../api/client';

const METRIC_CONFIG = [
  { key: 'calls', label: 'Calls', icon: '📞', color: 'blue' },
  { key: 'screenings', label: 'Screenings', icon: '📋', color: 'indigo' },
  { key: 'interviews', label: 'Interviews', icon: '🎤', color: 'purple' },
  { key: 'offers', label: 'Offers', icon: '📄', color: 'emerald' },
  { key: 'hires', label: 'Hires', icon: '✅', color: 'teal' },
  { key: 'cvSourced', label: 'CVs Sourced', icon: '🔍', color: 'amber' },
] as const;

type MetricKey = (typeof METRIC_CONFIG)[number]['key'];

const COLOR_CLASSES: Record<string, { bg: string; fill: string; text: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-950/40', fill: 'bg-blue-600', text: 'text-blue-700 dark:text-blue-300' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-950/40', fill: 'bg-indigo-600', text: 'text-indigo-700 dark:text-indigo-300' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-950/40', fill: 'bg-purple-600', text: 'text-purple-700 dark:text-purple-300' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', fill: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-950/40', fill: 'bg-teal-600', text: 'text-teal-700 dark:text-teal-300' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-950/40', fill: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-300' },
};

function getAchievementColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

export function MyTargetsWidget() {
  const [progress, setProgress] = useState<RecruiterTargetProgressRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getApi<RecruiterTargetProgressRecord[]>('/recruiter-targets/my')
      .then((data) => {
        if (mounted) setProgress(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setProgress([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (progress.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-lg">
          🎯
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Activity Targets
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your daily &amp; monthly performance goals set by your team leader.
          </p>
        </div>
      </div>

      {/* Target Cards */}
      {progress.map((p) => {
        const periodLabel = p.target.period === 'daily' ? '☀️ Today' : `📅 ${p.target.month || 'This Month'}`;
        return (
          <div key={p.target.id} className="space-y-3">
            {/* Period Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {periodLabel}
              </span>
              {p.target.setByName && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Set by {p.target.setByName}
                </span>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {METRIC_CONFIG.map((m) => {
                const target = p.target[m.key as keyof typeof p.target] as number;
                const actual = p.actual[m.key as MetricKey];
                if (target === 0) return null; // Skip zero targets
                const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
                const colors = COLOR_CLASSES[m.color] ?? COLOR_CLASSES['blue'];

                return (
                  <div
                    key={m.key}
                    className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{m.icon}</span>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{m.label}</span>
                      </div>
                      <span className={`text-[11px] font-extrabold ${getAchievementColor(pct)}`}>
                        {pct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className={colors.text}>{actual}</span>
                      <span className="text-slate-400 dark:text-slate-500">/ {target}</span>
                    </div>

                    <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${colors.fill}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            {p.target.notes && (
              <div className="px-3 py-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">📝 Note:</span> {p.target.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
