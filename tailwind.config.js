/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
      },
      animation: {
        'fade-up': 'fadeUp .5s ease both',
        'pulse-dot': 'pulseDot 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
