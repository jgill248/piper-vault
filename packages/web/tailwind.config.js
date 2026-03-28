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
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-headings': '#e2e8f0',
            '--tw-prose-invert-headings': '#e2e8f0',
            '--tw-prose-invert-body': '#94a3b8',
            '--tw-prose-invert-td-borders': 'rgba(255,255,255,0.1)',
            '--tw-prose-invert-th-borders': 'rgba(171,214,0,0.4)',
            h1: { fontFamily: 'JetBrains Mono, monospace', fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' },
            h2: { fontFamily: 'JetBrains Mono, monospace', fontSize: '1.35rem', fontWeight: '600', marginBottom: '0.4rem' },
            h3: { fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.3rem' },
            table: { width: '100%', borderCollapse: 'collapse' },
            'thead th': { borderBottomColor: 'rgba(171,214,0,0.4)', paddingBottom: '0.4rem' },
            'tbody td': { borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: '0.35rem', paddingBottom: '0.35rem' },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
