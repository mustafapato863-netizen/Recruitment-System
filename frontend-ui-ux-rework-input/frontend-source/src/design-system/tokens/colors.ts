/*************************************************************************************************************
 * RecruitFlow Enterprise Design System - Color Tokens
 * Palette aligned with Enterprise Visual Identity and Component Interaction Reference.
 *************************************************************************************************************/

export const designSystemColors = {
  light: {
    // Surfaces & Neutrals
    canvas: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceSubtle: "#F8F9FB",
    surfaceMuted: "#F1F5F9",
    border: "#CBD5E1",
    borderSubtle: "#ECEFF3",
    borderStrong: "#9CA3AF",

    // Text & Ink
    inkPrimary: "#0F172A",      // Ink 950
    inkSecondary: "#334155",    // Ink 700
    inkTertiary: "#475569",     // Ink 500
    inkMuted: "#64748B",        // Ink 400

    // Semantic Actions
    primary: "#1D4ED8",         // Action 700
    primaryHover: "#2563EB",    // Action 600
    primaryFocus: "#1E40AF",    // Action 700
    primarySoft: "rgba(29, 78, 216, 0.10)",
    primaryGlow: "rgba(29, 78, 216, 0.18)",

    // Neon Accents
    neonCyan: "#22D3EE",
    neonViolet: "#7C3AED",

    // Status
    success: "#15803D",
    successStrong: "#0F766E",
    successSoft: "#E8FAF2",
    successBorder: "rgba(0, 168, 89, 0.3)",

    warning: "#B45309",
    warningStrong: "#92400E",
    warningSoft: "#FFF7E8",
    warningBorder: "rgba(180, 83, 9, 0.3)",

    danger: "#B91C1C",
    dangerStrong: "#991B1B",
    dangerSoft: "#FFF0F1",
    dangerBorder: "rgba(185, 28, 28, 0.3)",

    info: "#0369A1",
    infoStrong: "#025695",
    infoSoft: "#E6F4FB",
    infoBorder: "rgba(3, 105, 161, 0.3)",
  },
  dark: {
    // Surfaces & Neutrals
    canvas: "#0F172A",
    surface: "#111827",
    surfaceSubtle: "#1F2937",
    surfaceMuted: "#273549",
    border: "#374151",
    borderSubtle: "#4B5563",
    borderStrong: "#6B7280",

    // Text & Ink
    inkPrimary: "#F8FAFC",      // Ink 950
    inkSecondary: "#D1D5DB",    // Ink 700
    inkTertiary: "#9CA3AF",     // Ink 500
    inkMuted: "#6B7280",        // Ink 400

    // Semantic Actions
    primary: "#3B82F6",         // Action 400 (blue-500)
    primaryHover: "#60A5FA",    // Action 300 (blue-300)
    primaryFocus: "#2563EB",    // Action 500 (blue-500)
    primarySoft: "rgba(59, 130, 246, 0.10)",
    primaryGlow: "rgba(59, 130, 246, 0.18)",

    // Neon Accents
    neonCyan: "#06B6D4",        // cyan-400
    neonViolet: "#8B5CF6",      // violet-500

    // Status
    success: "#10B981",
    successStrong: "#059669",
    successSoft: "rgba(16, 185, 129, 0.1)",
    successBorder: "rgba(16, 185, 129, 0.3)",

    warning: "#F59E0B",
    warningStrong: "#D97706",
    warningSoft: "#FEF3C7",
    warningBorder: "rgba(245, 158, 11, 0.3)",

    danger: "#EF4444",
    dangerStrong: "#DC2626",
    dangerSoft: "#FECACA",
    dangerBorder: "rgba(239, 44, 44, 0.3)",

    info: "#3B82F6",
    infoStrong: "#2563EB",
    infoSoft: "rgba(59, 130, 246, 0.1)",
    infoBorder: "rgba(59, 130, 246, 0.3)",
  },
} as const;

export type DesignSystemColors = typeof designSystemColors;
