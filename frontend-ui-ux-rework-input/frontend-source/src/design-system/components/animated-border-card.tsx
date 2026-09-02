"use client";

import React from "react";

export interface AnimatedBorderCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  isDark?: boolean;
}

/**
 * AnimatedBorderCard - Glassmorphic card surrounded by an animated rotating conic gradient border.
 */
export const AnimatedBorderCard: React.FC<AnimatedBorderCardProps> = ({
  children,
  className = "",
  innerClassName = "",
  isDark = true,
}) => {
  return (
    <div
      className={`relative rounded-[1.35rem] p-[1.5px] transition-all duration-300 ${className}`.trim()}
      style={{
        background:
          "conic-gradient(from var(--border-angle, 0deg) at 50% 50%, #00A3E0 0%, #00A859 25%, #0069B4 50%, #43B02A 75%, #00A3E0 100%)",
        animation: "sgh-spin-border 8s linear infinite",
      }}
    >
      <div
        className={`relative z-10 rounded-[1.25rem] p-6 sm:p-8 backdrop-blur-2xl transition-colors ${
          isDark
            ? "bg-slate-900/90 border border-white/10 text-white shadow-2xl"
            : "bg-white/90 border border-white/80 text-slate-900 shadow-xl"
        } ${innerClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
};

export default AnimatedBorderCard;
