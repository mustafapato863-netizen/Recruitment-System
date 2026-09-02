"use client";

import React from "react";

export type SghButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type SghButtonSize = "sm" | "md" | "lg";

export interface SghButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SghButtonVariant;
  size?: SghButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const SghButton: React.FC<SghButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const sizeClasses: Record<SghButtonSize, string> = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-11 px-4 text-xs font-semibold rounded-xl gap-2",
    lg: "h-13 px-6 text-sm font-bold rounded-xl gap-2.5",
  };

  const variantClasses: Record<SghButtonVariant, string> = {
    primary:
      "bg-gradient-to-r from-[#0084CE] via-[#00A3E0] to-[#00A859] text-white shadow-md shadow-[#00A3E0]/25 hover:shadow-lg hover:shadow-[#00A3E0]/35 hover:brightness-105 active:scale-[0.99] border-none",
    secondary:
      "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700",
    outline:
      "bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60",
    ghost:
      "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 border-none",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 border-none",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00A3E0]/40 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Processing...</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default SghButton;
