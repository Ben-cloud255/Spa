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
          50: '#fcfdfc',
          100: '#f8faf8',
          200: '#e8eeea',
          300: '#dce6df',
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
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalBackdropIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        modalContentIn: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        pulseOnce: {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.18)' },
          '60%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.45s ease-out both',
        modalBackdropIn: 'modalBackdropIn 0.18s ease-out both',
        modalContentIn: 'modalContentIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        pulseOnce: 'pulseOnce 0.5s ease-in-out',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

