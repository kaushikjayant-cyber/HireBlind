/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        indigo: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        emerald: {
          500: '#10B981',
          100: '#D1FAE5',
        },
        amber: {
          500: '#F59E0B',
          100: '#FEF3C7',
        },
        red: {
          500: '#EF4444',
          100: '#FEE2E2',
        },
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'card': '0 0 0 1px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
