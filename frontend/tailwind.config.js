/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial MAGNO (mockups aprobados)
        magno: {
          dark:   '#3d6b35',   // Verde oscuro — cabeceras, botones primarios, nav
          medium: '#5a8f50',   // Verde medio — hover, secundario
        },
        // Semánticos (reutilizan las variables de Tailwind internamente)
        status: {
          paid:    '#16a34a',  // ✓ pagó — verde pago
          unpaid:  '#dc2626',  // ✗ no pagó — rojo
          fine:    '#f59e0b',  // multas, advertencias — ámbar
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
