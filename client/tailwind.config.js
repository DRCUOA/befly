/** @type {import('tailwindcss').Config} */
function cv(name) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgb(var(${name}) / ${opacityValue})`
      : `rgb(var(${name}))`
}

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Crimson Pro', 'serif'],
        'sans': ['Inter', 'sans-serif'],
        /* The writing surface uses this — see --font-typewriter in index.css. */
        'typewriter': [
          'Courier Prime',
          'American Typewriter',
          'Courier New',
          'ui-monospace',
          'monospace',
        ],
      },
      colors: {
        'paper': cv('--color-paper'),
        'surface': cv('--color-surface'),
        'ink': cv('--color-ink'),
        'ink-light': cv('--color-ink-light'),
        'ink-lighter': cv('--color-ink-lighter'),
        'ink-whisper': cv('--color-ink-whisper'),
        'line': cv('--color-line'),
        'accent': cv('--color-accent'),
        'accent-hover': cv('--color-accent-hover'),
        'accent-muted': cv('--color-accent-muted'),
        /* Coromandel Dusk palette extras — for highlights and celebratory UI.
           Constant across modes so they read as deliberate accents. */
        'highlight': cv('--color-highlight'), /* Solar Scarlet */
        'gold': cv('--color-gold'),           /* Horizon Gold  */
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        /* Breathing space tokens — P2-uix-05 / cni-05 (4px grid). Fallbacks ensure padding works if vars fail to resolve. */
        'breath-xs': 'var(--space-xs, 4px)',
        'breath-sm': 'var(--space-sm, 8px)',
        'breath-md': 'var(--space-md, 16px)',
        'breath-lg': 'var(--space-lg, 24px)',
        'breath-xl': 'var(--space-xl, 32px)',
        'breath-2xl': 'var(--space-2xl, 48px)',
        'breath-3xl': 'var(--space-3xl, 64px)',
        'breath-4xl': 'var(--space-4xl, 80px)',
      },
      lineHeight: {
        'relaxed': '1.8',
        'reading': '2.2',
        'loose': '2.4',
      },
      transitionDuration: {
        'slow': '500ms',
        'slower': '800ms',
        'slowest': '1200ms',
      },
      transitionTimingFunction: {
        'gentle': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
