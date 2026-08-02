import type { Frecuencia, Moneda, FijoInput } from './db'

const FRECUENCIAS: Frecuencia[] = ['mensual', 'bimestral', 'anual']

function parseMoneda(v: unknown): Moneda {
  return v === 'USD' ? 'USD' : 'ARS'
}

/** Texto → string recortado, o null si queda vacío. */
function textOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/** Valida y normaliza el body de una plantilla de gasto fijo. null si falta nombre. */
export function parseFijo(body: Record<string, unknown>): FijoInput | null {
  const nombre = String(body?.nombre ?? '').trim()
  if (!nombre) return null
  const frecuencia = FRECUENCIAS.includes(body?.frecuencia as Frecuencia)
    ? (body.frecuencia as Frecuencia)
    : 'mensual'
  const dia = body?.diaVencimiento == null || body.diaVencimiento === ''
    ? null
    : Math.min(31, Math.max(1, Math.round(Number(body.diaVencimiento))))
  const mesAncla = frecuencia === 'mensual'
    ? null
    : Math.min(12, Math.max(1, Math.round(Number(body?.mesAncla ?? 1))))
  return {
    nombre,
    categoria: String(body?.categoria ?? 'Otros'),
    pagador: String(body?.pagador ?? 'Compartido'),
    moneda: parseMoneda(body?.moneda),
    montoEstimado: Math.round(Number(body?.montoEstimado ?? 0)),
    diaVencimiento: dia,
    frecuencia,
    mesAncla,
    medioPago: textOrNull(body?.medioPago),
    notas: textOrNull(body?.notas),
    automatico: body?.automatico === true,
  }
}

export { parseMoneda, textOrNull }
