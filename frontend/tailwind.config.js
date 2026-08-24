/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Retained from v1 so any stray legacy class keeps resolving.
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          50: '#F9F8F7',
          100: '#F0EFED',
          200: '#E6E5E3',
        },
        // v2 dark canvas.
        ink: {
          950: '#06060A',
          900: '#0A0A11',
          850: '#0F0F18',
          800: '#14141F',
          700: '#1C1C2A',
          600: '#272738',
          500: '#343449',
        },
        accent: {
          cyan: '#22D3EE',
          violet: '#A78BFA',
          indigo: '#818CF8',
          lime: '#A3E635',
          amber: '#FBBF24',
          rose: '#FB7185',
        },
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        aurora: 'aurora 22s ease-in-out infinite',
        'aurora-slow': 'aurora 34s ease-in-out infinite reverse',
        float: 'float 7s ease-in-out infinite',
        'spin-slow': 'spin 14s linear infinite',
        'sweep': 'sweep 2.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%, -8%, 0) scale(1.15)' },
          '66%': { transform: 'translate3d(-7%, 5%, 0) scale(0.92)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(220%)' },
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.04)',
        card: '0 2px 8px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)',
        focus: '0 0 0 3px rgba(59, 130, 246, 0.15)',
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px -12px rgba(129,140,248,0.45)',
        'glow-lg': '0 0 0 1px rgba(255,255,255,0.07), 0 24px 80px -20px rgba(167,139,250,0.55)',
        lift: '0 18px 50px -24px rgba(0,0,0,0.9)',
      },
    },
  },
  plugins: [],
};
