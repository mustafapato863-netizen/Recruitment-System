/**
 * Saudi German Health (SGH) Design System - Motion & Animation Tokens
 */

export const sghAnimations = {
  durations: {
    instant: "100ms",
    fast: "200ms",
    normal: "300ms",
    slow: "500ms",
    splash: "2000ms",
  },
  easings: {
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    spring: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
    bouncy: {
      type: "spring",
      stiffness: 300,
      damping: 15,
    },
  },
  // Reusable motion variants for motion/react / Framer Motion
  variants: {
    fadeIn: {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -6 },
    },
    scaleUp: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    },
    floating: {
      animate: {
        y: [0, -6, 0],
        rotate: [0, 1, -1, 0],
        transition: {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        },
      },
    },
  },
} as const;
