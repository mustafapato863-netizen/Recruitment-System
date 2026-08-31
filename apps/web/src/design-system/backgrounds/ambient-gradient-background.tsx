"use client";

import React from "react";
import { ThinkingDots } from "./thinking-dots";

export interface AmbientGradientBackgroundProps {
  children?: React.ReactNode;
  showDots?: boolean;
  isDark?: boolean;
  className?: string;
}

/**
 * AmbientGradientBackground - Multi-layered glowing ambient mesh background.
 * Combines deep healthcare navy/slate gradients, radial glowing spotlights, and animated particle matrix.
 */
export const AmbientGradientBackground: React.FC<AmbientGradientBackgroundProps> = ({
  children,
  showDots = true,
  isDark = true,
  className = "",
}) => {
  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden transition-colors duration-500 ${
        isDark ? "bg-[#0B132B] text-slate-100" : "bg-slate-50 text-slate-900"
      } ${className}`.trim()}
    >
      {/* 1. Ambient Radial Spotlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-Center Cyan Glow */}
        <div
          className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[500px] rounded-full blur-3xl opacity-30 ${
            isDark
              ? "bg-[radial-gradient(circle,rgba(0,163,224,0.35)_0%,transparent_70%)]"
              : "bg-[radial-gradient(circle,rgba(0,163,224,0.2)_0%,transparent_70%)]"
          }`}
        />

        {/* Bottom-Right Emerald Glow */}
        <div
          className={`absolute -bottom-40 right-0 w-[500px] sm:w-[700px] h-[450px] rounded-full blur-3xl opacity-25 ${
            isDark
              ? "bg-[radial-gradient(circle,rgba(0,168,89,0.3)_0%,transparent_70%)]"
              : "bg-[radial-gradient(circle,rgba(0,168,89,0.15)_0%,transparent_70%)]"
          }`}
        />

        {/* Mid-Left Subtle Blue Glow */}
        <div
          className={`absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full blur-3xl opacity-20 ${
            isDark
              ? "bg-[radial-gradient(circle,rgba(0,105,180,0.35)_0%,transparent_70%)]"
              : "bg-[radial-gradient(circle,rgba(0,105,180,0.12)_0%,transparent_70%)]"
          }`}
        />
      </div>

      {/* 2. Thinking Dots Particle Grid */}
      {showDots && <ThinkingDots isDark={isDark} />}

      {/* 3. Foreground Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default AmbientGradientBackground;
