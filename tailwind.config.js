/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090c',
          900: '#0c0e13',
          800: '#131620',
          700: '#1b1f2d',
          600: '#262b3c',
          500: '#3a4156',
          400: '#5a6179',
          300: '#858ca3',
          200: '#b8bdd0',
          100: '#e5e8f2',
        },
        accent: {
          DEFAULT: '#ec4899',
          soft: '#f9a8d4',
          deep: '#db2777',
        },
        emerald: {
          glow: '#4ade80',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Fraunces',
          'ui-serif',
          'Georgia',
          'serif',
        ],
      },
      boxShadow: {
        card: '0 20px 60px -20px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.3)',
        'accent-glow': '0 0 0 1px rgba(236,72,153,0.3), 0 10px 40px -10px rgba(236,72,153,0.35)',
        'matchbox-glow': '0 0 10px rgba(164, 59, 122, 0.15), inset 0 0 10px rgba(164, 59, 122, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'match-left': 'matchLeft 1.5s ease-in-out infinite',
        'match-right': 'matchRight 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        matchLeft: {
          '0%, 100%': { transform: 'translateX(-16px)', opacity: '0.5', boxShadow: '0 0 0 rgba(236, 72, 153, 0)' },
          '50%': { transform: 'translateX(8px)', opacity: '0.9', boxShadow: '0 0 12px rgba(236, 72, 153, 0.5)' },
        },
        matchRight: {
          '0%, 100%': { transform: 'translateX(16px)', opacity: '0.5', boxShadow: '0 0 0 rgba(236, 72, 153, 0)' },
          '50%': { transform: 'translateX(-8px)', opacity: '0.9', boxShadow: '0 0 12px rgba(236, 72, 153, 0.5)' },
        },
      },
    },
  },
  plugins: [],
};
