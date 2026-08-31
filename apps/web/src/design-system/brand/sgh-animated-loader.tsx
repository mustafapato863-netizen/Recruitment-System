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
  const [displayText, setDisplayText] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [isFinished, setIsFinished] = React.useState(false);
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

      // Typewriter calculation
      const textProgress = Math.min(1, elapsed / (durationMs * 0.75));
      const charCount = Math.floor(textProgress * textSequence.length);
      setDisplayText(textSequence.slice(0, charCount));

      if (elapsed < durationMs) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayText(textSequence);
        setProgress(100);
        setIsFinished(true);
        if (onComplete) {
          setTimeout(onComplete, 300);
        }
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [durationMs, textSequence, onComplete]);

  const loaderContent = (
    <div className={`flex flex-col items-center justify-center p-8 select-none text-center ${className}`.trim()}>
      {/* 1. Animated Dual-Wing SGH Heart Emblem with Glowing Ring */}
      <div className="relative mb-8 flex items-center justify-center">
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
          className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#00A3E0]/30 to-[#00A859]/30 blur-2xl pointer-events-none"
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
          <SghHeartSvg size={130} glow={true} />
        </motion.div>
      </div>

      {/* 2. Storyboard Typewriter Text: "Saudi German Health" */}
      <div className="mb-2 flex items-center justify-center min-h-[36px]">
        <h2
          className={`text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-1 transition-colors ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          <span>{displayText}</span>
          {!isFinished && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className={`inline-block w-1 h-7 rounded-full ms-0.5 ${
                isDark ? "bg-[#38BDF8]" : "bg-[#0084CE]"
              }`}
            />
          )}
        </h2>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-xs sm:text-sm font-medium max-w-sm mb-8 transition-colors ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
        >
          {subtitle}
        </motion.p>
      )}

      {/* 3. Multi-stop SGH Gradient Progress Bar */}
      <div className="w-64 sm:w-80 space-y-2.5">
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
          className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-3xl transition-colors duration-300 ${
            isDark ? "bg-[#0B132B]/95 text-white" : "bg-[#F8FAFC]/95 text-slate-900"
          }`}
        >
          {/* Subtle Ambient Radial Spotlight */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity ${
              isDark
                ? "bg-[radial-gradient(circle_at_center,rgba(0,163,224,0.20)_0%,transparent_70%)]"
                : "bg-[radial-gradient(circle_at_center,rgba(0,163,224,0.12)_0%,transparent_70%)]"
            }`}
          />
          {loaderContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  return loaderContent;
}

export default SghAnimatedLoader;
