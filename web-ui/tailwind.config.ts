import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16222E', soft: '#4A5967', faint: '#8895A1' },
        paper: '#F2F5F7',
        line: '#DCE3E8',
        brand: { DEFAULT: '#0B7A8C', dark: '#075E6C', soft: '#DDF0F3' },
        open: '#2E8B57',
        low: '#C58315',
        full: '#C03A3A',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: { pop: '0 12px 32px -12px rgba(22,34,46,.35)' },
    },
  },
  plugins: [],
};
export default config;
