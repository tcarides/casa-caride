import type { Moneda, Prioridad, OpcionInput } from './db'

export function parseMoneda(v: unknown): Moneda {
  return v === 'USD' ? 'USD' : 'ARS'
}

const PRIORIDADES: Prioridad[] = ['alta', 'media', 'baja']
export function parsePrioridad(v: unknown): Prioridad {
  return PRIORIDADES.includes(v as Prioridad) ? (v as Prioridad) : 'media'
}

/** Texto → string recortado, o null si queda vacío. */
export function textOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/** Normaliza un link: solo http/https; agrega https:// si falta esquema. null si no sirve. */
export function normUrl(v: unknown): string | null {
  let s = String(v ?? '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

/** Precio en centavos desde un número/string, o null. */
export function parsePrecio(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? n : null
}

/** Normaliza el body de una opción (alternativa de un deseo). */
export function parseOpcion(o: unknown): OpcionInput {
  const x = (o ?? {}) as Record<string, unknown>
  return {
    titulo: textOrNull(x.titulo),
    link: normUrl(x.link),
    imagenUrl: normUrl(x.imagenUrl),
    precio: parsePrecio(x.precio),
    moneda: parseMoneda(x.moneda),
    nota: textOrNull(x.nota),
  }
}

/** Una opción sin ningún dato útil (no vale la pena guardarla). */
export function opcionVacia(o: OpcionInput): boolean {
  return !o.link && o.precio == null && !o.imagenUrl && !o.titulo && !o.nota
}
