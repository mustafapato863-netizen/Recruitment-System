/**
 * Saudi German Health (SGH) Design System - Gradients
 * Brand dual-wing linear and radial gradients for web, canvas, and vector elements.
 */

export const sghGradients = {
  // Brand Text Gradient
  brandText: "linear-gradient(135deg, #00A3E0 0%, #00A859 100%)",

  // Brand Surface & Button Gradient
  brandButton: "linear-gradient(135deg, #0084CE 0%, #00A3E0 45%, #00A859 100%)",
  brandButtonHover: "linear-gradient(135deg, #0072CE 0%, #0092D0 45%, #00974E 100%)",

  // Left Wing (Cyan -> Blue)
  leftWing: {
    stops: [
      { offset: "0%", color: "#00B5F1" },
      { offset: "45%", color: "#00A3E0" },
      { offset: "100%", color: "#0069B4" },
    ],
    css: "linear-gradient(135deg, #00B5F1 0%, #00A3E0 45%, #0069B4 100%)",
  },

  // Right Wing (Lime -> Emerald -> Forest Green)
  rightWing: {
    stops: [
      { offset: "0%", color: "#43B02A" },
      { offset: "35%", color: "#00A859" },
      { offset: "80%", color: "#00843D" },
      { offset: "100%", color: "#005A2B" },
    ],
    css: "linear-gradient(135deg, #43B02A 0%, #00A859 35%, #00843D 80%, #005A2B 100%)",
  },

  // Ambient Mesh Background Gradients
  ambientMeshLight: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 163, 224, 0.15), transparent 70%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(0, 168, 89, 0.1), transparent 60%)",
  ambientMeshDark: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 163, 224, 0.22), transparent 70%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(0, 168, 89, 0.15), transparent 60%)",

  // Rotating Card Border Frame
  conicBorder: "conic-gradient(from var(--border-angle, 0deg) at 50% 50%, #00A3E0 0%, #00A859 25%, #0069B4 50%, #43B02A 75%, #00A3E0 100%)",
} as const;
