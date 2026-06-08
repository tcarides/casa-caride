import type { NextConfig } from 'next'

/**
 * El shell es el "host" de la PWA: vive en la raíz del dominio, sirve el
 * launcher, el manifest y el service worker, y reúne a las mini-apps bajo
 * un único origen mediante rewrites (patrón Multi-Zones de Next.js).
 *
 * - /super/*  y /casas/*  -> apps Next independientes (zonas).
 * - /olivia/* y /fixture/* -> estáticos servidos desde public/ (no necesitan rewrite).
 *
 * En desarrollo las zonas corren en localhost (3001, 3002).
 * En producción se apuntan a las URLs de Vercel vía variables de entorno.
 */
const SUPER_URL = process.env.SUPER_URL ?? 'http://localhost:3001'
const CASAS_URL = process.env.CASAS_URL ?? 'http://localhost:3002'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/super', destination: `${SUPER_URL}/super` },
      { source: '/super/:path*', destination: `${SUPER_URL}/super/:path*` },
      { source: '/casas', destination: `${CASAS_URL}/casas` },
      { source: '/casas/:path*', destination: `${CASAS_URL}/casas/:path*` },
      // Apps estáticas: URL limpia -> index.html en public/
      { source: '/olivia', destination: '/olivia/index.html' },
      { source: '/fixture', destination: '/fixture/index.html' },
    ]
  },
}

export default nextConfig
