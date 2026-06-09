import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', '"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Acento del design system: amarillo eléctrico (texto near-black encima)
        accent: {
          DEFAULT: '#FFD600',
          fg: '#0A0A0A',
          50: '#FFFDE6',
          300: '#FFD600',
          400: '#FFE93A',
          500: '#FFD600',
          600: '#F5C400',
          700: '#D4A800',
        },
        // Superficies near-black del design system (reemplaza la ramp slate)
        slate: {
          50: '#FAFAF8',
          100: '#F2F2F0',
          200: '#E8E8E4',
          300: '#C0C0BA',
          400: '#9A9A94',
          500: '#6E6E68',
          600: '#3A3A3A',
          700: '#2A2A2A',
          800: '#1A1A1A',
          900: '#0A0A0A',
          950: '#050505',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.25), 0 4px 16px -4px rgb(0 0 0 / 0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
