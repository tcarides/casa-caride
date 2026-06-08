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
 * En producción se apuntan a las URLs de Vercel vía variables de entorno
 * (SUPER_URL / CASAS_URL). Si faltan en producción, falla el build con un
 * error claro en vez de rutear silenciosamente a localhost.
 */
function zoneUrl(name: 'SUPER' | 'CASAS', devPort: number): string {
  const url = process.env[`${name}_URL`]
  if (url) return url.replace(/\/$/, '')
  // En Vercel las env vars deben estar seteadas: si falta, fallar claro.
  if (process.env.VERCEL) {
    throw new Error(
      `Falta la variable de entorno ${name}_URL (URL de la zona ${name.toLowerCase()} en Vercel).`
    )
  }
  return `http://localhost:${devPort}`
}

const SUPER_URL = zoneUrl('SUPER', 3001)
const CASAS_URL = zoneUrl('CASAS', 3002)

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
