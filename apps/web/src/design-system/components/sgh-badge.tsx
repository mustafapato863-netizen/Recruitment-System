"use client";

import React from "react";

export type SghBadgeVariant = "cyan" | "emerald" | "brand" | "success" | "info" | "warning" | "error" | "neutral";

export interface SghBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SghBadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SghBadge: React.FC<SghBadgeProps> = ({
  variant = "cyan",
  dot = false,
  children,
  className = "",
  ...props
}) => {
  const variantStyles: Record<SghBadgeVariant, { badge: string; dot: string }> = {
    cyan: {
      badge: "border-[#00A3E0]/30 bg-[#00A3E0]/10 text-[#0084CE] dark:text-[#38BDF8]",
      dot: "bg-[#00A3E0]",
    },
    emerald: {
      badge: "border-[#00A859]/30 bg-[#00A859]/10 text-[#00843D] dark:text-[#34D399]",
      dot: "bg-[#00A859]",
    },
    brand: {
      badge: "border-[#00A3E0]/30 bg-gradient-to-r from-[#00A3E0]/10 to-[#00A859]/10 text-[#0084CE] dark:text-[#38BDF8]",
      dot: "bg-gradient-to-r from-[#00A3E0] to-[#00A859]",
    },
    success: {
      badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    info: {
      badge: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      dot: "bg-blue-500",
    },
    warning: {
      badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    error: {
      badge: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
      dot: "bg-rose-500",
    },
    neutral: {
      badge: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",
      dot: "bg-slate-400",
    },
  };

  const current = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors ${current.badge} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dot}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dot}`} />
        </span>
      )}
      {children}
    </span>
  );
};

export default SghBadge;
