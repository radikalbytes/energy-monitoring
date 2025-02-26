/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}', // Escanea las páginas
    './components/**/*.{js,ts,jsx,tsx}', // Escanea los componentes
    './app/**/*.{js,ts,jsx,tsx}', // Si usas App Router
  ],
  theme: {
    extend: {}, // Puedes personalizar colores, fuentes, etc. aquí
  },
  plugins: [],
};