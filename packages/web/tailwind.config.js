/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          base: 'var(--color-base)',
          surface: 'var(--color-surface)',
          sunken: 'var(--color-sunken)',
          raised: 'var(--color-raised)',
          border: 'var(--color-border)',
        },
        phosphor: {
          DEFAULT: '#abd600',
          dim: 'rgba(171, 214, 0, 0.3)',
          glow: 'rgba(171, 214, 0, 0.15)',
        },
        ui: {
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          dim: 'var(--color-dim)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
      },
      borderWidth: {
        3: '3px',
      },
    },
  },
  plugins: [],
};
