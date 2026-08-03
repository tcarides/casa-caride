// Categorías sugeridas (texto libre; esta lista alimenta los selects).
export const CATEGORIAS = [
  'Vivienda',
  'Servicios',
  'Impuestos',
  'Suscripciones',
  'Supermercado',
  'Hogar',
  'Sueldos',
  'Seguridad',
  'Salud',
  'Transporte',
  'Otros',
] as const

// Medios de pago sugeridos (texto libre con datalist).
export const MEDIOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'Mercado Pago (servicios)',
  'Tarjeta crédito MP',
  'Débito automático',
  'AFIP',
  'Municipalidad (web)',
  'Tarjeta Visa de Flor',
  'Tarjeta crédito de Flor',
] as const

export const COMPARTIDO = 'Compartido'

export const FRECUENCIA_LABEL: Record<string, string> = {
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  anual: 'Anual',
}
