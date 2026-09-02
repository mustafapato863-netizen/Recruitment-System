"use client";

import React from "react";

export type SghAlertVariant = "warning" | "error" | "info" | "success";

export interface SghAlertProps {
  variant?: SghAlertVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const SghAlert: React.FC<SghAlertProps> = ({
  variant = "warning",
  title,
  children,
  onDismiss,
  className = "",
}) => {
  const variantMap: Record<
    SghAlertVariant,
    { border: string; bg: string; text: string; titleColor: string; iconSvg: React.ReactNode }
  > = {
    warning: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-700 dark:text-amber-300",
      titleColor: "text-amber-800 dark:text-amber-200",
      iconSvg: (
        <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    error: {
      border: "border-rose-500/30",
      bg: "bg-rose-500/10",
      text: "text-rose-700 dark:text-rose-300",
      titleColor: "text-rose-800 dark:text-rose-200",
      iconSvg: (
        <svg className="h-4 w-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
    },
    info: {
      border: "border-[#00A3E0]/30",
      bg: "bg-[#00A3E0]/10",
      text: "text-[#0084CE] dark:text-[#38BDF8]",
      titleColor: "text-[#0069B4] dark:text-[#7DD3FC]",
      iconSvg: (
        <svg className="h-4 w-4 text-[#00A3E0] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
        </svg>
      ),
    },
    success: {
      border: "border-[#00A859]/30",
      bg: "bg-[#00A859]/10",
      text: "text-[#00843D] dark:text-[#34D399]",
      titleColor: "text-[#005A2B] dark:text-[#6EE7B7]",
      iconSvg: (
        <svg className="h-4 w-4 text-[#00A859] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const current = variantMap[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-xl border p-3.5 text-xs backdrop-blur-md transition-all ${current.border} ${current.bg} ${className}`.trim()}
    >
      <div className="mt-0.5">{current.iconSvg}</div>
      <div className="flex-1 space-y-0.5">
        {title && <div className={`font-bold tracking-tight ${current.titleColor}`}>{title}</div>}
        <div className={`leading-relaxed ${current.text}`}>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${current.text}`}
          aria-label="Dismiss alert"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SghAlert;
