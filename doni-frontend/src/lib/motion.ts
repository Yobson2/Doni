import type { Variants } from 'framer-motion'

// Durations aligned with CSS custom properties (--duration-fast, --duration-normal, etc.)
export const duration = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.7,
} as const

// Easings aligned with CSS custom properties (--ease-in, --ease-out, etc.)
export const ease = {
  default: [0.4, 0, 0.2, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  out: [0, 0, 0.2, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  bounce: [0.68, -0.55, 0.265, 1.55] as const,
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal, ease: ease.default },
  },
}

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.default },
  },
}

export const fadeSlideDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.default },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.normal, ease: ease.default },
  },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.default },
  },
}

export const pageTransition: Variants = {
  initial: { opacity: 0, x: 10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.normal, ease: ease.default },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: { duration: duration.fast, ease: ease.in },
  },
}

// Map of variant names for use with AnimatedContainer
export const variants = {
  fadeIn,
  fadeSlideUp,
  fadeSlideDown,
  scaleIn,
} as const

export type VariantName = keyof typeof variants
