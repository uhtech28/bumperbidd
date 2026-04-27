import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // BumperBid brand palette — sampled from the provided logo
        ink: '#000000',
        obsidian: '#0a0a0a',
        graphite: '#111114',
        bone: '#f8f8f5',
        brand: {
          50: '#FFF7D6',
          100: '#FFEFA8',
          200: '#FCE07A',
          300: '#F5CC4E',
          400: '#E6B72C',
          500: '#D4A017',
          600: '#B8870E',
          700: '#8E6908',
          800: '#634A05',
          900: '#3A2B02',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        wordmark: ['var(--font-wordmark)', 'var(--font-display)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 40px -10px rgba(212,160,23,0.45)',
        card: '0 20px 60px -20px rgba(0,0,0,0.7)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
