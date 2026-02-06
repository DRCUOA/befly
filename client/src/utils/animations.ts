/**
 * Animation utilities for reading experience
 */

export const ANIMATION_DURATIONS = {
  fast: 300,
  normal: 500,
  slow: 800,
  slower: 1200,
  slowest: 2000,
} as const

export const ANIMATION_EASINGS = {
  gentle: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

/**
 * Calculate delay for staggered animations
 */
export function getStaggerDelay(index: number, baseDelay: number = 100): number {
  return index * baseDelay
}

/**
 * Fade in animation style
 */
export function fadeInStyle(delay: number = 0, duration: number = ANIMATION_DURATIONS.normal) {
  return {
    animation: `fadeIn ${duration}ms ${ANIMATION_EASINGS.smooth} ${delay}ms forwards`,
    opacity: 0,
  }
}

/**
 * Slide in from top animation style
 */
export function slideInFromTopStyle(delay: number = 0, duration: number = 600) {
  return {
    animation: `slideInFromTop ${duration}ms ${ANIMATION_EASINGS.smooth} ${delay}ms forwards`,
    opacity: 0,
    transform: 'translateY(-20px)',
  }
}

/**
 * Paragraph reveal animation style
 */
export function paragraphRevealStyle(delay: number = 0, duration: number = ANIMATION_DURATIONS.slow) {
  return {
    animation: `paragraphFadeIn ${duration}ms ${ANIMATION_EASINGS.smooth} ${delay}ms forwards`,
    opacity: 0,
  }
}

/**
 * Gentle fade in animation style (for completion page)
 */
export function gentleFadeInStyle(delay: number = 0, duration: number = ANIMATION_DURATIONS.slowest) {
  return {
    animation: `gentleFadeIn ${duration}ms ${ANIMATION_EASINGS.gentle} ${delay}ms forwards`,
    opacity: 0,
    transform: 'translateY(8px)',
  }
}

/**
 * Text reveal animation style
 */
export function textRevealStyle(delay: number = 0, duration: number = 1500) {
  return {
    animation: `textReveal ${duration}ms ${ANIMATION_EASINGS.smooth} ${delay}ms forwards`,
    opacity: 0,
  }
}

/**
 * Interface fade out transition
 */
export function interfaceFadeOutStyle(duration: number = ANIMATION_DURATIONS.slower) {
  return {
    transition: `opacity ${duration}ms ${ANIMATION_EASINGS.gentle}, transform ${duration}ms ${ANIMATION_EASINGS.gentle}`,
  }
}

/**
 * Smooth scroll behavior
 */
export function smoothScrollTo(element: HTMLElement | null, offset: number = 0) {
  if (!element) return
  
  const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
  const offsetPosition = elementPosition - offset

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth',
  })
}

/**
 * Reading mode transition
 */
export function readingModeTransition(duration: number = ANIMATION_DURATIONS.slower) {
  return {
    transition: `opacity ${duration}ms ${ANIMATION_EASINGS.gentle}, transform ${duration}ms ${ANIMATION_EASINGS.gentle}`,
  }
}
