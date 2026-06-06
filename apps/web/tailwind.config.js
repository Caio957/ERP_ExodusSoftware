/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Roxo elegante — identidade Exodus (maquiagem/cosméticos).
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Acento rosé — toque "beauty" para destaques e gradientes.
        accent: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
        },
        // Azul-violeta profundo para o toque "tech" em fundos/sombras.
        ink: {
          900: '#1a1530',
          950: '#0f0b1f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      // Alvos de toque mínimos confortáveis para o tablet do balcão.
      minHeight: { touch: '3.25rem' },
      minWidth: { touch: '3.25rem' },
      boxShadow: {
        soft: '0 2px 12px -2px rgb(15 23 42 / 0.08), 0 4px 24px -8px rgb(15 23 42 / 0.06)',
        elevated: '0 8px 30px -6px rgb(15 23 42 / 0.12), 0 2px 8px -2px rgb(15 23 42 / 0.06)',
        brand: '0 10px 30px -8px rgb(124 58 237 / 0.45)',
        'brand-lg': '0 20px 50px -12px rgb(124 58 237 / 0.55)',
        glow: '0 0 0 1px rgb(255 255 255 / 0.6) inset, 0 8px 30px -8px rgb(124 58 237 / 0.35)',
        'glow-brand': '0 0 0 1px rgb(168 85 247 / 0.35), 0 0 25px -4px rgb(124 58 237 / 0.45)',
        'glow-accent': '0 0 0 1px rgb(236 72 153 / 0.35), 0 0 25px -4px rgb(236 72 153 / 0.45)',
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(76 29 149 / 0.18)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #a855f7 45%, #ec4899 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 50%, #fce7f3 100%)',
        'accent-gradient': 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
        'brand-radial':
          'radial-gradient(1200px 600px at 100% 0%, rgb(168 85 247 / 0.18), transparent 60%), radial-gradient(900px 500px at 0% 100%, rgb(236 72 153 / 0.14), transparent 55%)',
        // Aurora viva (animada via background-position) para fundos premium.
        aurora:
          'radial-gradient(60% 60% at 15% 20%, rgb(124 58 237 / 0.22), transparent 60%), radial-gradient(50% 50% at 85% 15%, rgb(236 72 153 / 0.20), transparent 55%), radial-gradient(55% 55% at 75% 90%, rgb(168 85 247 / 0.18), transparent 60%), radial-gradient(45% 45% at 10% 95%, rgb(244 114 182 / 0.16), transparent 55%)',
        // Brilho diagonal (sheen) usado em botões/superfícies no hover.
        sheen:
          'linear-gradient(110deg, transparent 25%, rgb(255 255 255 / 0.45) 50%, transparent 75%)',
        // Grade sutil para textura "tech".
        grid: 'linear-gradient(rgb(124 58 237 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(124 58 237 / 0.05) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        // Aurora respirando: move e escala o conjunto de radiais.
        aurora: {
          '0%, 100%': { backgroundPosition: '0% 50%, 100% 50%, 50% 100%, 0% 100%', filter: 'hue-rotate(0deg)' },
          '50%': { backgroundPosition: '100% 50%, 0% 50%, 50% 0%, 100% 0%', filter: 'hue-rotate(12deg)' },
        },
        // Orbe flutuante decorativo.
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '33%': { transform: 'translateY(-18px) translateX(10px)' },
          '66%': { transform: 'translateY(10px) translateX(-12px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.06)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'sheen-move': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        aurora: 'aurora 18s ease-in-out infinite',
        float: 'float 12s ease-in-out infinite',
        'float-slow': 'float 18s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 5s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        pop: 'pop 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
