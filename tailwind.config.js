/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090c',
          900: '#0b0d11',
          850: '#101319',
          800: '#161a22',
          700: '#1f242e',
          600: '#2b313d',
          500: '#3a4150',
        },
        gold: {
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        gain: '#34d399',
        loss: '#fb7185',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.035em',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 40px -24px rgba(0,0,0,0.95)',
        gold: '0 0 0 1px rgba(251,191,36,0.35), 0 10px 34px -12px rgba(251,191,36,0.35)',
        lift: '0 24px 60px -30px rgba(0,0,0,1)',
      },
      backgroundImage: {
        'gold-sheen': 'linear-gradient(135deg, #fde68a 0%, #fbbf24 45%, #d97706 100%)',
        'card-glow': 'radial-gradient(120% 100% at 50% 0%, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0) 60%)',
        'page-glow': 'radial-gradient(85% 55% at 50% -10%, rgba(251,191,36,0.10) 0%, rgba(8,9,12,0) 70%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ticker-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        'ticker-pulse': 'ticker-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
