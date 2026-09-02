import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  message?: string;
  duration?: number; // ms, default 4500. Set 0 for persistent.
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ─── Tone config ────────────────────────────────────────────────────────────

const toneConfig: Record<ToastTone, { icon: IconName; ring: string; iconColor: string; bar: string }> = {
  success: { icon: 'check-circle', ring: 'ring-rf-success/20', iconColor: 'text-rf-success', bar: 'bg-rf-success' },
  error:   { icon: 'alert-triangle', ring: 'ring-rf-danger/20', iconColor: 'text-rf-danger',  bar: 'bg-rf-danger'  },
  warning: { icon: 'alert-triangle', ring: 'ring-rf-warning/20', iconColor: 'text-rf-warning', bar: 'bg-rf-warning' },
  info:    { icon: 'document',       ring: 'ring-rf-info/20',    iconColor: 'text-rf-info',    bar: 'bg-rf-info'    },
};

// ─── Single Toast Item ───────────────────────────────────────────────────────

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const cfg = toneConfig[item.tone ?? 'info'];
  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
      className={[
        'relative flex min-w-[280px] max-w-[380px] items-start gap-3 overflow-hidden',
        'rounded-xl border border-rf-border bg-rf-surface p-3.5 shadow-[var(--shadow-hover)]',
        'ring-1', cfg.ring,
        'animate-in slide-in-from-right-4 fade-in duration-200',
      ].join(' ')}
    >
      {/* Tone accent bar */}
      <span className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl ${cfg.bar}`} aria-hidden="true" />

      {/* Icon */}
      <span className={`mt-0.5 shrink-0 pl-1 ${cfg.iconColor}`} aria-hidden="true">
        <Icon name={cfg.icon} size={15} />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold text-rf-ink leading-snug m-0">{item.title}</p>
        {item.message && (
          <p className="text-[10.5px] font-medium text-rf-ink-muted leading-snug mt-0.5 m-0">{item.message}</p>
        )}
        {item.action && (
          <button
            type="button"
            onClick={() => { item.action!.onClick(); onDismiss(item.id); }}
            className="mt-1.5 text-[10.5px] font-bold text-rf-action hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rf-action"
          >
            {item.action.label}
          </button>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-rf-ink-muted hover:text-rf-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-rf-action rounded"
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback((options: ToastOptions): string => {
    const id = `toast-${++idCounter.current}`;
    const duration = options.duration ?? 4500;

    setToasts((prev) => [...prev.slice(-4), { ...options, id }]); // max 5 visible

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          role="region"
          aria-label="Notifications"
          className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastCard item={toast} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
