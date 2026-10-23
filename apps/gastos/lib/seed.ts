import type { FijoInput } from './db'

// Gastos fijos típicos de la casa (Tomás + Flor). Se cargan una sola vez con el
// botón "Cargar mis gastos fijos"; el seed es idempotente (no duplica por nombre)
// y los montos arrancan en 0 para completarlos a medida que se pagan.
// El supermercado NO está: es variable (se carga suelto cada mes).

type SeedFijo = Omit<FijoInput, 'frecuencia' | 'mesAncla'> & {
  frecuencia?: FijoInput['frecuencia']
  mesAncla?: number | null
}

const f = (s: SeedFijo): FijoInput => ({
  frecuencia: 'mensual',
  mesAncla: null,
  ...s,
})

export const SEED_FIJOS: FijoInput[] = [
  f({ nombre: 'Alquiler', categoria: 'Vivienda', pagador: 'Tomás', moneda: 'USD',
      montoEstimado: 0, diaVencimiento: 10, medioPago: 'Efectivo',
      notas: 'En dólares. Lo busca María Delia, del 1 al 10.', automatico: false }),
  f({ nombre: 'Edenor (luz)', categoria: 'Servicios', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Mercado Pago (servicios)',
      notas: 'N° cliente 9407974146', automatico: false }),
  f({ nombre: 'Naturgy (gas)', categoria: 'Servicios', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Mercado Pago (servicios)',
      notas: 'N° cliente 2007606', automatico: false }),
  f({ nombre: 'ABL', categoria: 'Impuestos', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Municipalidad (web)',
      notas: 'Alumbrado, barrido y limpieza. N° cliente 670763.', automatico: false }),
  f({ nombre: 'Aysa (agua)', categoria: 'Servicios', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Mercado Pago (servicios)',
      notas: 'N° cliente 2268660', automatico: false }),
  f({ nombre: 'Garita seguridad', categoria: 'Seguridad', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Transferencia',
      notas: 'Alias Ferias26 — Diana Chang Paredes', automatico: false }),
  f({ nombre: 'Verisure (alarma)', categoria: 'Seguridad', pagador: 'Flor', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta crédito de Flor',
      notas: 'Alarma. Lo paga Flor con su tarjeta de crédito.', automatico: true }),
  f({ nombre: 'Movistar (internet)', categoria: 'Servicios', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Mercado Pago (servicios)',
      notas: null, automatico: false }),
  f({ nombre: 'Ada — aportes (AFIP)', categoria: 'Sueldos', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'AFIP',
      notas: 'Comprobante desde AFIP → Casas Particulares.', automatico: false }),
  f({ nombre: 'Ada — sueldo', categoria: 'Sueldos', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Efectivo o transferencia',
      notas: 'Chica que limpia en casa.', automatico: false }),
  f({ nombre: 'Piletero', categoria: 'Hogar', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Transferencia',
      notas: 'Una vez por mes.', automatico: false }),
  f({ nombre: 'Jardinero', categoria: 'Hogar', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Transferencia',
      notas: 'Cada vez que viene — omitir los meses que no viene.', automatico: false }),
  f({ nombre: 'Zoe (paseadora de Fabi)', categoria: 'Hogar', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Transferencia',
      notas: 'Paseadora de Fabi. Varias transferencias durante el mes — sumar el total.', automatico: false }),

  // ── Suscripciones ──
  f({ nombre: 'HBO Max', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta crédito MP',
      notas: null, automatico: true }),
  f({ nombre: 'Apple', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta', notas: null, automatico: true }),
  f({ nombre: 'Amazon Prime', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Vía DGO', notas: null, automatico: true }),
  f({ nombre: 'DGO', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta', notas: null, automatico: true }),
  f({ nombre: 'Netflix', categoria: 'Suscripciones', pagador: 'Flor', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta Visa de Flor',
      notas: null, automatico: true }),
  f({ nombre: 'YouTube Premium', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta crédito MP',
      notas: null, automatico: true }),
  f({ nombre: 'Paramount+', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Mercado Pago (servicios)',
      notas: null, automatico: false }),
  f({ nombre: 'Meli+', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Mercado Pago (servicios)',
      notas: null, automatico: false }),
  f({ nombre: 'PedidosYa Plus', categoria: 'Suscripciones', pagador: 'Tomás', moneda: 'ARS',
      montoEstimado: 0, diaVencimiento: null, medioPago: 'Tarjeta crédito MP',
      notas: null, automatico: true }),
]
