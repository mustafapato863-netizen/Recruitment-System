/**
 * Saudi German Health (SGH) Design System - Color Tokens
 * Official enterprise healthcare palette with WCAG AAA / AA contrast ratios.
 */

export const sghColors = {
  // 1. Primary Brand Identity Tokens
  brand: {
    cyan: {
      light: "#38BDF8", // Lighter tint for dark theme highlights
      default: "#00A3E0", // Official SGH Cyan
      dark: "#0084CE", // Deep Cyan for borders / dark accents
      deep: "#0069B4", // Royal Cyan-Blue wing shadow
    },
    emerald: {
      lime: "#43B02A", // Lime crest accent
      default: "#00A859", // Official SGH Emerald Green
      dark: "#00843D", // Deep Hospital Emerald
      forest: "#005A2B", // Forest green wing shadow
    },
    navy: {
      light: "#1E293B",
      default: "#0F172A",
      dark: "#0B132B", // Deep Healthcare Space Navy
      deepest: "#030712",
    },
  },

  // 2. Semantic Status Tokens
  status: {
    success: {
      bg: "rgba(0, 168, 89, 0.1)",
      border: "rgba(0, 168, 89, 0.3)",
      text: "#00A859",
      textDark: "#34D399",
    },
    info: {
      bg: "rgba(0, 163, 224, 0.1)",
      border: "rgba(0, 163, 224, 0.3)",
      text: "#0084CE",
      textDark: "#38BDF8",
    },
    warning: {
      bg: "rgba(245, 158, 11, 0.1)",
      border: "rgba(245, 158, 11, 0.3)",
      text: "#D97706",
      textDark: "#FBBF24",
    },
    error: {
      bg: "rgba(239, 68, 68, 0.1)",
      border: "rgba(239, 68, 68, 0.3)",
      text: "#DC2626",
      textDark: "#F87171",
    },
    neutral: {
      bg: "rgba(100, 116, 139, 0.1)",
      border: "rgba(100, 116, 139, 0.2)",
      text: "#64748B",
      textDark: "#94A3B8",
    },
  },

  // 3. Surface & Neutral Tokens
  surfaces: {
    light: {
      bg: "#F8FAFC",
      card: "#FFFFFF",
      cardHover: "#F1F5F9",
      border: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      textMuted: "#94A3B8",
    },
    dark: {
      bg: "#0B132B",
      card: "rgba(15, 23, 42, 0.85)",
      cardHover: "rgba(30, 41, 59, 0.9)",
      border: "rgba(255, 255, 255, 0.1)",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      textMuted: "#64748B",
    },
  },
} as const;

export type SghColors = typeof sghColors;
