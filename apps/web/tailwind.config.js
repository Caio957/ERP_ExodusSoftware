/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // AZUL — identidade primária Exodus (royal/cobalto).
        brand: {
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
          950: '#172554',
        },
        // DOURADO — acento de luxo Exodus.
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Alias semântico para o dourado.
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Azul-noite profundo para fundos dramáticos.
        ink: {
          800: '#172554',
          900: '#0f1e44',
          950: '#0a142e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: { touch: '3.25rem' },
      minWidth: { touch: '3.25rem' },
      boxShadow: {
        soft: '0 2px 12px -2px rgb(15 23 42 / 0.08), 0 4px 24px -8px rgb(15 23 42 / 0.06)',
        elevated: '0 8px 30px -6px rgb(15 23 42 / 0.14), 0 2px 8px -2px rgb(15 23 42 / 0.06)',
        brand: '0 10px 30px -8px rgb(37 99 235 / 0.5)',
        'brand-lg': '0 22px 55px -12px rgb(29 78 216 / 0.6)',
        gold: '0 10px 30px -8px rgb(245 158 11 / 0.5)',
        'gold-lg': '0 22px 55px -12px rgb(217 119 6 / 0.55)',
        glow: '0 0 0 1px rgb(255 255 255 / 0.6) inset, 0 8px 30px -8px rgb(37 99 235 / 0.4)',
        'glow-brand': '0 0 0 1px rgb(59 130 246 / 0.4), 0 0 28px -4px rgb(37 99 235 / 0.55)',
        'glow-gold': '0 0 0 1px rgb(251 191 36 / 0.5), 0 0 28px -4px rgb(245 158 11 / 0.6)',
        card: '0 1px 2px rgb(15 23 42 / 0.05), 0 12px 28px -14px rgb(30 58 138 / 0.28)',
      },
      backgroundImage: {
        // Azul royal (base de botões/superfícies fortes).
        'brand-gradient': 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
        // Dourado metálico.
        'gold-gradient': 'linear-gradient(135deg, #b45309 0%, #f59e0b 45%, #fcd34d 100%)',
        // Assinatura Exodus: azul → dourado (títulos, detalhes, bordas).
        'brand-gold': 'linear-gradient(120deg, #1d4ed8 0%, #3b82f6 40%, #f59e0b 100%)',
        // Hero dramático azul-noite (login/painéis).
        'royal-gradient': 'linear-gradient(150deg, #0a142e 0%, #172554 35%, #1e40af 70%, #2563eb 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #fef3c7 100%)',
        'brand-radial':
          'radial-gradient(1200px 600px at 100% 0%, rgb(37 99 235 / 0.18), transparent 60%), radial-gradient(900px 500px at 0% 100%, rgb(245 158 11 / 0.16), transparent 55%)',
        // Aurora viva azul + dourado.
        aurora:
          'radial-gradient(55% 55% at 12% 18%, rgb(37 99 235 / 0.28), transparent 60%), radial-gradient(50% 50% at 88% 12%, rgb(245 158 11 / 0.24), transparent 55%), radial-gradient(55% 55% at 78% 88%, rgb(59 130 246 / 0.22), transparent 60%), radial-gradient(45% 45% at 8% 92%, rgb(251 191 36 / 0.2), transparent 55%)',
        // Brilho dourado diagonal (sheen) para botões azuis.
        sheen:
          'linear-gradient(110deg, transparent 25%, rgb(253 230 138 / 0.55) 48%, rgb(255 255 255 / 0.35) 52%, transparent 78%)',
        // Grade "tech" azul.
        grid: 'linear-gradient(rgb(37 99 235 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(37 99 235 / 0.06) 1px, transparent 1px)',
        // Padrão de pontos para textura (menos minimalismo).
        dots: 'radial-gradient(rgb(37 99 235 / 0.12) 1.4px, transparent 1.4px)',
        shine: 'conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgb(245 158 11 / 0.18) 60deg, transparent 120deg, rgb(37 99 235 / 0.16) 200deg, transparent 280deg)',
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
        aurora: {
          '0%, 100%': { backgroundPosition: '0% 50%, 100% 50%, 50% 100%, 0% 100%' },
          '50%': { backgroundPosition: '100% 50%, 0% 50%, 50% 0%, 100% 0%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '33%': { transform: 'translateY(-20px) translateX(12px)' },
          '66%': { transform: 'translateY(12px) translateX(-14px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.95', transform: 'scale(1.08)' },
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
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        aurora: 'aurora 18s ease-in-out infinite',
        float: 'float 12s ease-in-out infinite',
        'float-slow': 'float 18s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4.5s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        pop: 'pop 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'spin-slow': 'spin-slow 22s linear infinite',
      },
    },
  },
  plugins: [],
};
