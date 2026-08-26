import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#152625',
        forest: {
          50: '#eef4f1',
          100: '#d7e6e1',
          200: '#aecac0',
          300: '#7fab9d',
          400: '#4f8b78',
          500: '#2f6b58',
          600: '#1f4f40',
          700: '#173d32',
          800: '#122f27',
          900: '#0d2019',
        },
        sand: {
          50: '#fdfcf9',
          100: '#f7f3ea',
          200: '#efe8d6',
          300: '#e2d5b8',
        },
        honey: {
          400: '#d3ab5c',
          500: '#c2933d',
          600: '#a3762b',
        },
        clay: '#b1614f',
        status: {
          inactive: '#8a9a94',
          pending: '#c2933d',
          active: '#2f6b58',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,38,37,0.06), 0 8px 24px rgba(21,38,37,0.06)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
