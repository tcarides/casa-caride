import next from 'eslint-config-next'

// Config base de ESLint (flat) compartida por todas las apps del monorepo.
// Cada app la re-exporta desde su propio eslint.config.mjs.
const config = [
  ...next,
  {
    rules: {
      // Reglas nuevas y muy estrictas de react-hooks v6 (orientadas al React
      // Compiler). Las dejamos como warning para no romper el lint con patrones
      // habituales (fetch/setState dentro de useEffect, refs en render con
      // react-leaflet, etc.). Se pueden ir limpiando de a poco.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  { ignores: ['**/.next/**', '**/node_modules/**', '**/next-env.d.ts'] },
]

export default config
