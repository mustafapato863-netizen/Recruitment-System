/* global module */

/**
 * Saudi German Health (SGH) Design System - Tailwind CSS Preset
 * Drop this preset into your `tailwind.config.js` or `tailwind.config.ts`:
 *
 * ```js
 * module.exports = {
 *   presets: [require('./design-system/tailwind/preset')],
 *   content: ['./app/**\/*.{ts,tsx}', './design-system/**\/*.{ts,tsx}']
 * }
 * ```
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        sgh: {
          cyan: {
            light: "#38BDF8",
            DEFAULT: "#00A3E0",
            dark: "#0084CE",
            deep: "#0069B4",
          },
          emerald: {
            lime: "#43B02A",
            DEFAULT: "#00A859",
            dark: "#00843D",
            forest: "#005A2B",
          },
          navy: {
            light: "#1E293B",
            DEFAULT: "#0F172A",
            dark: "#0B132B",
            deepest: "#030712",
          },
        },
      },
      backgroundImage: {
        "sgh-brand-gradient": "linear-gradient(135deg, #00A3E0 0%, #00A859 100%)",
        "sgh-btn-gradient": "linear-gradient(135deg, #0084CE 0%, #00A3E0 45%, #00A859 100%)",
      },
      boxShadow: {
        "sgh-glow": "0 10px 30px rgba(0, 163, 224, 0.3), 0 0 20px rgba(0, 168, 89, 0.2)",
        "sgh-cyan-glow": "0 0 25px rgba(0, 163, 224, 0.45)",
      },
      animation: {
        "sgh-pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
};
