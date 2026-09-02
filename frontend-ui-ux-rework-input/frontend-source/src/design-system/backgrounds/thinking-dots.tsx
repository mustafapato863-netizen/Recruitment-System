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
 */
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

    let animationFrameId: number;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    let time = 0;

    const draw = () => {
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;

      ctx.clearRect(0, 0, displayW, displayH);

      const cols = Math.ceil(displayW / spacing);
      const rows = Math.ceil(displayH / spacing);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;

          // Wave equation
          const dist = Math.sin(i * 0.18 + time) + Math.cos(j * 0.18 + time);
          const normalized = (dist + 2) / 4; // 0 to 1

          const currentDotSize = dotSize * (0.6 + normalized * 0.8);

          // Color palette interpolation between Cyan (#00A3E0) and Emerald (#00A859)
          if (isDark) {
            // Dark Mode: Soft glowing cyan-slate particles
            const opacity = 0.08 + normalized * 0.28;
            ctx.fillStyle = `rgba(${i % 2 === 0 ? "0, 163, 224" : "0, 168, 89"}, ${opacity})`;
          } else {
            // Light Mode: Subtle slate/blue-tinted particles
            const opacity = 0.06 + normalized * 0.2;
            ctx.fillStyle = `rgba(${i % 2 === 0 ? "0, 132, 206" : "0, 168, 89"}, ${opacity})`;
          }

          ctx.beginPath();
          ctx.arc(x, y, currentDotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      time += speed;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
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
