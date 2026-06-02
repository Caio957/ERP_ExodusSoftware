/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          900: '#4c1d95',
        },
      },
      // Alvos de toque mínimos confortáveis para o tablet do balcão.
      minHeight: { touch: '3.25rem' },
      minWidth: { touch: '3.25rem' },
    },
  },
  plugins: [],
};
