"use client";

import * as React from "react";
import { motion } from "motion/react";
import { SghHeartSvg } from "./sgh-heart-svg";

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface SghAnimatedLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string;
  className?: string;
  /** Login passes false so the heart stays put and does not run an infinite motion loop. */
  animated?: boolean;
}

export function SghAnimatedLogo({
  size = 96,
  showText = true,
  subtitle = "Unified Healthcare Systems Portal",
  className = "",
  animated = true,
}: SghAnimatedLogoProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const motionEnabled = animated && !prefersReducedMotion();

  if (!motionEnabled) {
    return (
      <div className={`flex flex-col items-center justify-center select-none text-center ${className}`.trim()}>
        <div className="relative flex items-center justify-center p-2" style={{ width: size * 1.3, height: size * 1.2 }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: 999,
              pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(0,163,224,0.28), rgba(0,168,89,0.12) 58%, transparent 72%)',
            }}
          />
          <SghHeartSvg size={size} glow />
        </div>
        {showText && (
          <div className="mt-2.5 flex flex-col items-center">
            <div className="flex items-center gap-1.5 font-extrabold tracking-tight text-foreground text-xl sm:text-2xl">
              <span>Saudi German</span>
              <span className="bg-gradient-to-r from-[#00A3E0] to-[#00A859] bg-clip-text text-transparent">
                Hospital
              </span>
            </div>
            {subtitle && (
              <p className="text-xs font-medium text-muted-foreground mt-0.5 tracking-wide">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center select-none text-center group ${className}`.trim()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. Interactive Animated Vector Emblem */}
      <div className="relative flex items-center justify-center p-2" style={{ width: size * 1.3, height: size * 1.2 }}>
        {/* Pulsing Cyan / Emerald Ambient Glow Halo */}
        <motion.div
          animate={{
            scale: isHovered ? [1.05, 1.25, 1.05] : [1, 1.15, 1],
            opacity: isHovered ? [0.65, 0.9, 0.65] : [0.35, 0.55, 0.35],
          }}
          transition={{
            duration: isHovered ? 1.5 : 2.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00A3E0]/40 via-[#00A859]/30 to-[#00843D]/25 blur-2xl pointer-events-none"
        />

        {/* Floating Heart with Spring Hover Effect */}
        <motion.div
          animate={{
            y: isHovered ? [0, -7, 0] : [0, -5, 0],
            rotate: isHovered ? [0, 2.5, -2.5, 0] : [0, 1, -1, 0],
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.96 }}
          transition={{
            duration: isHovered ? 2 : 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 cursor-pointer filter drop-shadow-[0_10px_25px_rgba(0,163,224,0.35)]"
        >
          <SghHeartSvg size={size} glow={true} />
        </motion.div>
      </div>

      {/* 2. Brand Typography */}
      {showText && (
        <div className="mt-2.5 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 font-extrabold tracking-tight text-foreground text-xl sm:text-2xl"
          >
            <span>Saudi German</span>
            <span className="bg-gradient-to-r from-[#00A3E0] to-[#00A859] bg-clip-text text-transparent">
              Hospital
            </span>
          </motion.div>

          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xs font-medium text-muted-foreground mt-0.5 tracking-wide"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
}

export default SghAnimatedLogo;
