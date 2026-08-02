import type { Frecuencia, FijoInput } from './db'

const FRECUENCIAS: Frecuencia[] = ['mensual', 'bimestral', 'anual']

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
    montoEstimado: Math.round(Number(body?.montoEstimado ?? 0)),
    diaVencimiento: dia,
    frecuencia,
    mesAncla,
  }
}
