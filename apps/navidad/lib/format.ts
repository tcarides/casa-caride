// Helpers de formato compartidos por la UI (cliente).

/** Centavos → "$ 12.345" (ARS) o "US$ 500" (USD). Sin decimales salvo que haya centavos. */
export function fmtMoney(centavos: number, moneda: 'ARS' | 'USD' = 'ARS'): string {
  const monto = centavos / 100
  const hasCents = Math.round(centavos) % 100 !== 0
  return monto.toLocaleString('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })
}

/** "12.345,50" (input) → centavos (entero). Tolera $, puntos y coma decimal. */
export function parseMoney(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(clean)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Host "lindo" de un link: "mercadolibre.com.ar" → "mercadolibre.com.ar". */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
