import type { MetadataRoute } from 'next'

/**
 * Manifest único de la PWA "Casa Caride". Al tener scope "/" cubre todas las
 * mini-apps (super, casas, olivia, fixture), que viven bajo el mismo origen.
 * Por eso se instala como UNA sola app con un solo ícono.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Casa Caride',
    short_name: 'Casa Caride',
    description: 'Las apps de la familia Caride en un solo lugar.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
