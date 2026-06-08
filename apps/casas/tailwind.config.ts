import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Color de acento de la app (teal)
        accent: {
          DEFAULT: '#14b8a6',
          fg: '#0f172a',
          50: '#f0fdfa',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
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
