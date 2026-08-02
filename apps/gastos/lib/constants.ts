// Categorías sugeridas (texto libre; esta lista alimenta los selects).
export const CATEGORIAS = [
  'Servicios',
  'Vivienda',
  'Impuestos',
  'Supermercado',
  'Transporte',
  'Salud',
  'Suscripciones',
  'Otros',
] as const

export const COMPARTIDO = 'Compartido'

export const FRECUENCIA_LABEL: Record<string, string> = {
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  anual: 'Anual',
}
