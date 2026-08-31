"use client";

import React from "react";

export interface SghInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const SghInput: React.FC<SghInputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  id,
  className = "",
  containerClassName = "",
  ...props
}) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className={`space-y-1.5 text-left w-full ${containerClassName}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          className={`h-11 w-full rounded-xl border text-xs transition-all focus:outline-none focus:ring-2 ${
            leftIcon ? "ps-10" : "ps-3.5"
          } ${rightIcon ? "pe-10" : "pe-3.5"} ${
            error
              ? "border-rose-500/80 bg-rose-500/5 text-slate-900 dark:text-slate-100 ring-2 ring-rose-500/20 focus:border-rose-500"
              : "border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0084CE] dark:focus:border-[#00A3E0] focus:ring-[#00A3E0]/20"
          } ${className}`.trim()}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {hint && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
      )}
    </div>
  );
};

export default SghInput;
