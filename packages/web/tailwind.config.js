/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          'container-lowest': 'var(--color-surface-container-lowest)',
          'container-low': 'var(--color-surface-container-low)',
          container: 'var(--color-surface-container)',
          'container-high': 'var(--color-surface-container-high)',
          'container-highest': 'var(--color-surface-container-highest)',
          dim: 'var(--color-surface-dim)',
          bright: 'var(--color-surface-bright)',
          variant: 'var(--color-surface-variant)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          container: 'var(--color-primary-container)',
          fixed: 'var(--color-primary-fixed)',
          'fixed-dim': 'var(--color-primary-fixed-dim)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          container: 'var(--color-secondary-container)',
        },
        tertiary: {
          DEFAULT: 'var(--color-tertiary)',
          container: 'var(--color-tertiary-container)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          container: 'var(--color-error-container)',
        },
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          variant: 'var(--color-on-surface-variant)',
        },
        'on-primary': {
          DEFAULT: 'var(--color-on-primary)',
          container: 'var(--color-on-primary-container)',
        },
        'on-secondary': {
          DEFAULT: 'var(--color-on-secondary)',
        },
        'on-error': {
          DEFAULT: 'var(--color-on-error)',
        },
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'var(--color-outline-variant)',
        },
        inverse: {
          surface: 'var(--color-inverse-surface)',
          'on-surface': 'var(--color-inverse-on-surface)',
          primary: 'var(--color-inverse-primary)',
        },
      },
      fontFamily: {
        headline: ['Newsreader', 'serif'],
        body: ['Work Sans', 'sans-serif'],
        label: ['Work Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0px',
        none: '0px',
        lg: '0px',
        xl: '0px',
        full: '9999px',
      },
      borderWidth: {
        3: '3px',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-headings': 'var(--color-on-surface)',
            '--tw-prose-body': 'var(--color-on-surface-variant)',
            '--tw-prose-td-borders': 'var(--color-outline-variant)',
            '--tw-prose-th-borders': 'var(--color-primary)',
            h1: { fontFamily: 'Newsreader, serif', fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' },
            h2: { fontFamily: 'Newsreader, serif', fontSize: '1.35rem', fontWeight: '600', marginBottom: '0.4rem' },
            h3: { fontFamily: 'Newsreader, serif', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.3rem' },
            table: { width: '100%', borderCollapse: 'collapse' },
            'thead th': { borderBottomColor: 'var(--color-primary)', paddingBottom: '0.4rem' },
            'tbody td': { borderTopColor: 'var(--color-outline-variant)', paddingTop: '0.35rem', paddingBottom: '0.35rem' },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
