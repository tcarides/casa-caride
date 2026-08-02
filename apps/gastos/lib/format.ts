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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** 'YYYY-MM' → "agosto 2026". */
export function fmtPeriodo(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}

/** Mes anterior/siguiente de un periodo 'YYYY-MM'. */
export function shiftPeriodo(periodo: string, delta: number): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Periodo actual 'YYYY-MM' (hora local). */
export function periodoHoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Fecha local hoy como 'YYYY-MM-DD'. */
export function fechaHoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → "vence 10 ago" (corto). */
export function fmtDiaCorto(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Número de mes 1..12 → "ago". */
export function mesCorto(m: number): string {
  return MESES_CORTOS[m - 1] ?? ''
}
