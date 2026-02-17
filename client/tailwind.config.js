/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Crimson Pro', 'serif'],
        'sans': ['Inter', 'sans-serif'],
      },
      colors: {
        'paper': '#FDFCFA',
        'ink': '#1A1A1A',
        'ink-light': '#4A4A4A',
        'ink-lighter': '#8A8A8A',
        'ink-whisper': '#B8B8B8',
        'line': '#E8E6E3',
        'accent': 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-muted': 'var(--color-accent-muted)',
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
