"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { SghHeartSvg } from "./sgh-heart-svg";

export interface SghAnimatedLoaderProps {
  fullScreen?: boolean;
  onComplete?: () => void;
  durationMs?: number;
  textSequence?: string;
  subtitle?: string;
  className?: string;
  isDark?: boolean;
}

export function SghAnimatedLoader({
  fullScreen = false,
  onComplete,
  durationMs = 2000,
  textSequence = "Saudi German Health",
  subtitle = "Authenticating & Loading Recruitment Workspace...",
  className = "",
  isDark: propIsDark,
}: SghAnimatedLoaderProps) {
  const [progress, setProgress] = React.useState(0);
  const [detectedDark, setDetectedDark] = React.useState(true);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      const isDarkMode =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.dataset.theme === "dark";
      setDetectedDark(isDarkMode);
    }
  }, []);

  const isDark = propIsDark !== undefined ? propIsDark : detectedDark;

  React.useEffect(() => {
    let frameId: number;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed < durationMs) {
        frameId = requestAnimationFrame(animate);
      } else {
        setProgress(100);
        if (onComplete) {
          setTimeout(onComplete, 300);
        }
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [durationMs, textSequence, onComplete]);

  const loaderContent = (
    <div className={`flex w-full max-w-[380px] flex-col items-center justify-center px-6 py-7 text-center select-none sm:px-8 sm:py-8 ${className}`.trim()}>
      {/* 1. Animated Dual-Wing SGH Heart Emblem with Glowing Ring */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Ambient Halo Glow */}
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            opacity: isDark ? [0.35, 0.65, 0.35] : [0.25, 0.5, 0.25],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-tr from-[#00A3E0]/30 to-[#00A859]/30 blur-2xl"
        />

        {/* Floating Heart Icon */}
        <motion.div
          animate={{
            y: [0, -8, 0],
            rotate: [0, 1.5, -1.5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 drop-shadow-[0_12px_28px_rgba(0,163,224,0.35)]"
        >
          <SghHeartSvg size={92} glow={true} />
        </motion.div>
      </div>

      {/* 2. Stable brand name: the progress and emblem carry the motion */}
      <div className="mb-2 flex min-h-[34px] w-full items-center justify-center">
        <h2
          className={`flex items-center gap-1 whitespace-nowrap text-xl font-extrabold tracking-tight transition-colors sm:text-2xl ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          <span>{textSequence}</span>
        </h2>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`mb-6 max-w-[300px] text-xs font-medium leading-5 transition-colors sm:text-sm ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
        >
          {subtitle}
        </motion.p>
      )}

      {/* 3. Multi-stop SGH Gradient Progress Bar */}
      <div className="w-full max-w-[300px] space-y-2.5">
        <div
          className={`relative h-2.5 w-full overflow-hidden rounded-full p-[1px] transition-colors ${
            isDark
              ? "bg-slate-800/90 border border-white/15"
              : "bg-slate-200/90 border border-slate-300/80"
          }`}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#0084CE] via-[#00A3E0] to-[#00A859] shadow-[0_0_12px_rgba(0,163,224,0.5)]"
            style={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        <div
          className={`flex items-center justify-between text-[11px] font-semibold px-1 transition-colors ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00A3E0] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A3E0]"></span>
            </span>
            Initializing Services
          </span>
          <span className={`font-mono font-bold ${isDark ? "text-[#38BDF8]" : "text-[#0084CE]"}`}>
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`fixed inset-0 z-[100] isolate flex items-center justify-center p-4 transition-colors duration-300 sm:p-6 ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          role="status"
          aria-live="polite"
          aria-label="Signing in"
        >
          <div
            className="pointer-events-none absolute inset-0 backdrop-blur-md"
            style={{
              backgroundColor: isDark ? "rgba(8, 19, 43, 0.88)" : "rgba(244, 250, 252, 0.94)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background: isDark
                ? "radial-gradient(circle at 50% 38%, rgba(0,163,224,0.18), transparent 48%)"
                : "radial-gradient(circle at 50% 38%, rgba(0,163,224,0.13), transparent 48%)",
            }}
          />
          <div
            className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-[28px] border shadow-2xl"
            style={{
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.98)",
              borderColor: isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.28)",
              boxShadow: isDark
                ? "0 24px 80px rgba(0, 0, 0, 0.42)"
                : "0 24px 80px rgba(15, 67, 91, 0.16)",
            }}
          >
            <div className="h-1 w-full bg-gradient-to-r from-[#0084CE] via-[#00A3E0] to-[#00A859]" aria-hidden="true" />
            {loaderContent}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return loaderContent;
}

export default SghAnimatedLoader;
