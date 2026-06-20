import type { NextConfig } from 'next'

/**
 * El shell es el "host" de la PWA: vive en la raíz del dominio, sirve el
 * launcher, el manifest y el service worker, y reúne a las mini-apps bajo
 * un único origen mediante rewrites (patrón Multi-Zones de Next.js).
 *
 * - /super/* y /casas/* -> apps Next independientes (zonas core, obligatorias).
 * - /fabian/* y /olivia/* -> zonas opcionales: si falta su _URL no rompe el
 *                          build, simplemente no se cablea la ruta (el tile igual aparece).
 * - /fixture/*          -> estático servido desde public/ (sin rewrite).
 *
 * En desarrollo las zonas corren en localhost (3001, 3002, 3003, 3004).
 * En producción se apuntan a las URLs de Vercel vía variables de entorno
 * (SUPER_URL / CASAS_URL / FABIAN_URL / OLIVIA_URL).
 */
function zoneUrl(name: string, devPort: number, optional = false): string | null {
  const url = process.env[`${name}_URL`]
  if (url) return url.replace(/\/$/, '')
  // En Vercel las env vars deben estar seteadas: si falta una obligatoria,
  // fallar claro en vez de rutear silenciosamente a localhost.
  if (process.env.VERCEL) {
    if (optional) return null
    throw new Error(
      `Falta la variable de entorno ${name}_URL (URL de la zona ${name.toLowerCase()} en Vercel).`
    )
  }
  return `http://localhost:${devPort}`
}

const SUPER_URL  = zoneUrl('SUPER', 3001)!
const CASAS_URL  = zoneUrl('CASAS', 3002)!
const FABIAN_URL = zoneUrl('FABIAN', 3003, true) // opcional: no rompe si falta
const OLIVIA_URL = zoneUrl('OLIVIA', 3004, true) // opcional: no rompe si falta
const CUENTAS_URL = zoneUrl('CUENTAS', 3005, true) // opcional: no rompe si falta

const nextConfig: NextConfig = {
  async rewrites() {
    const rules = [
      { source: '/super', destination: `${SUPER_URL}/super` },
      { source: '/super/:path*', destination: `${SUPER_URL}/super/:path*` },
      { source: '/casas', destination: `${CASAS_URL}/casas` },
      { source: '/casas/:path*', destination: `${CASAS_URL}/casas/:path*` },
      // App estática: URL limpia -> index.html en public/
      { source: '/fixture', destination: '/fixture/index.html' },
    ]

    // Zona Fabián: solo si su URL está configurada.
    if (FABIAN_URL) {
      rules.push(
        { source: '/fabian', destination: `${FABIAN_URL}/fabian` },
        { source: '/fabian/:path*', destination: `${FABIAN_URL}/fabian/:path*` },
      )
    }

    // Zona Olivia: solo si su URL está configurada.
    if (OLIVIA_URL) {
      rules.push(
        { source: '/olivia', destination: `${OLIVIA_URL}/olivia` },
        { source: '/olivia/:path*', destination: `${OLIVIA_URL}/olivia/:path*` },
      )
    }

    // Zona Cuentas Claras: solo si su URL está configurada.
    if (CUENTAS_URL) {
      rules.push(
        { source: '/cuentas', destination: `${CUENTAS_URL}/cuentas` },
        { source: '/cuentas/:path*', destination: `${CUENTAS_URL}/cuentas/:path*` },
      )
    }

    return rules
  },
}

export default nextConfig
