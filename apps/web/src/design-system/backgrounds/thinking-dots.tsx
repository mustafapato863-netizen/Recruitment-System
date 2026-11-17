"use client";

import React, { useEffect, useRef } from "react";

export interface ThinkingDotsProps {
  dotSize?: number;
  spacing?: number;
  color?: string;
  speed?: number;
  fadeEdge?: boolean;
  className?: string;
  isDark?: boolean;
}

/**
 * ThinkingDots - Interactive / Ambient canvas particle grid effect.
 * Renders an ethereal, pulsing matrix of dots with responsive resize and high-DPI scaling.
 * The grid is coarsened so a 1440x900 viewport stays well under a thousand arcs per frame.
 * The loop does not run for reduced motion, a hidden document, or an offscreen canvas.
 */
const MAX_ARCS_PER_FRAME = 480;

function prefersReducedMotion() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function gridStep(displayW: number, displayH: number, spacing: number) {
  const base = Math.max(1, spacing);
  const cols = Math.max(1, Math.ceil(displayW / base));
  const rows = Math.max(1, Math.ceil(displayH / base));
  let factor = 1;
  if (cols * rows > MAX_ARCS_PER_FRAME) {
    factor = Math.ceil(Math.sqrt((cols * rows) / MAX_ARCS_PER_FRAME));
  }
  let step = base * factor;
  const steppedCols = Math.ceil(displayW / step);
  const steppedRows = Math.ceil(displayH / step);
  if (steppedCols * steppedRows > MAX_ARCS_PER_FRAME) {
    factor += 1;
    step = base * factor;
  }
  return step;
}

export const ThinkingDots: React.FC<ThinkingDotsProps> = ({
  dotSize = 1.5,
  spacing = 28,
  speed = 0.0012,
  className = "",
  isDark = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let frameId = 0;
    let time = 0;
    let reduced = prefersReducedMotion();
    let onScreen = true;

    const hidden = () => document.visibilityState === "hidden";
    const shouldAnimate = () => !reduced && !hidden() && onScreen;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;
      const nextW = Math.max(1, Math.floor(displayW * dpr));
      const nextH = Math.max(1, Math.floor(displayH * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (advance: boolean) => {
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;
      ctx.clearRect(0, 0, displayW, displayH);
      if (displayW <= 0 || displayH <= 0) return;

      const step = gridStep(displayW, displayH, spacing);
      const cols = Math.ceil(displayW / step);
      const rows = Math.ceil(displayH / step);

      for (let i = 0; i < cols; i++) {
        const rgb = isDark
          ? i % 2 === 0
            ? "0, 163, 224"
            : "0, 168, 89"
          : i % 2 === 0
            ? "0, 132, 206"
            : "0, 168, 89";
        for (let j = 0; j < rows; j++) {
          const x = i * step;
          const y = j * step;
          const dist = Math.sin(i * 0.18 + time) + Math.cos(j * 0.18 + time);
          const normalized = (dist + 2) / 4;
          const currentDotSize = dotSize * (0.6 + normalized * 0.8);
          const opacity = isDark ? 0.08 + normalized * 0.28 : 0.06 + normalized * 0.2;
          ctx.fillStyle = `rgba(${rgb}, ${opacity})`;
          ctx.beginPath();
          ctx.arc(x, y, currentDotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (advance) time += speed;
    };

    const cancel = () => {
      if (!frameId) return;
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const tick = () => {
      frameId = 0;
      if (!shouldAnimate()) return;
      draw(true);
      if (!shouldAnimate()) return;
      frameId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frameId || !shouldAnimate()) return;
      frameId = requestAnimationFrame(tick);
    };

    const paintStatic = () => {
      cancel();
      resize();
      draw(false);
    };

    const onResize = () => {
      resize();
      if (reduced) draw(false);
    };

    const onVisibility = () => {
      if (shouldAnimate()) start();
      else cancel();
    };

    const motionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const onMotion = () => {
      reduced = motionQuery?.matches ?? false;
      if (reduced) paintStatic();
      else if (shouldAnimate()) start();
      else cancel();
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        if (reduced) return;
        if (shouldAnimate()) start();
        else cancel();
      });
      observer.observe(canvas);
    }

    resize();
    if (reduced) draw(false);
    else if (shouldAnimate()) start();

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery?.addEventListener("change", onMotion);

    return () => {
      cancel();
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery?.removeEventListener("change", onMotion);
    };
  }, [dotSize, spacing, speed, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`.trim()}
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default ThinkingDots;
