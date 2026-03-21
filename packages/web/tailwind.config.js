/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          base: '#05070A',
          surface: '#111417',
          sunken: '#0c0e12',
          raised: '#282a2e',
          border: '#45474a',
        },
        phosphor: {
          DEFAULT: '#abd600',
          dim: 'rgba(171, 214, 0, 0.3)',
          glow: 'rgba(171, 214, 0, 0.15)',
        },
        ui: {
          text: '#e1e2e7',
          muted: '#8b8d93',
          dim: '#5a5c62',
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
    },
  },
  plugins: [],
};
