/**
 * Saudi German Health (SGH) Design System - Spacing & Sizing Tokens
 */

export const sghSpacing = {
  // Spacing scale (4px base unit)
  "0": "0px",
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "7": "28px",
  "8": "32px",
  "9": "36px",
  "10": "40px",
  "11": "44px",
  "12": "48px",
  "14": "56px",
  "16": "64px",
  "20": "80px",
  "24": "96px",
  "28": "112px",
  "32": "128px",
  "36": "144px",
  "40": "160px",
  "44": "176px",
  "48": "192px",
  "52": "208px",
  "56": "224px",
  "60": "240px",
  "64": "256px",
  "72": "288px",
  "80": "320px",
  "88": "352px",
  "96": "384px",
} as const;

export type SghSpacing = typeof sghSpacing[keyof typeof sghSpacing];

// Commonly used spacing values for convenience
export const spacing = {
  xs: sghSpacing["2"],   // 8px
  sm: sghSpacing["3"],   // 12px
  md: sghSpacing["4"],   // 16px
  lg: sghSpacing["5"],   // 20px
  xl: sghSpacing["6"],   // 24px
  "2xl": sghSpacing["8"], // 32px
  "3xl": sghSpacing["10"], // 40px
  "4xl": sghSpacing["12"], // 48px
  "5xl": sghSpacing["16"], // 64px
  "6xl": sghSpacing["20"], // 80px
} as const;

export type SpacingValue = typeof spacing[keyof typeof spacing];