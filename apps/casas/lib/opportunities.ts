/**
 * Motor de "Oportunidades" — v1 (transparente y ajustable; lo iteramos con feedback).
 *
 * Idea: puntuar cada casa combinando señales de mercado ($/m² vs el promedio de su
 * barrio) con las preferencias del comprador (zonas, presupuesto, criterios de la casa).
 * Cada punto suma a un score 0-100 y deja una "razón" legible para explicar el por qué.
 *
 * Limitaciones v1 (a mejorar en próximas iteraciones):
 *  - No hay `description` en los datos → amenities (jardín/pileta/orientación) se infieren
 *    SOLO del título (cobertura baja).
 *  - `rooms` = ambientes (≠ dormitorios). Usamos rooms>=4 como proxy de "3+ dorm".
 *  - ArgenProp queda afuera (sin precio/m² por el parser roto).
 *  - "Aprende de favoritos" todavía no — es el próximo paso.
 */
import type { Property } from './types'

// ── Preferencias del comprador (ver memoria del proyecto). Ajustables. ───────────
export const PREFS = {
  budgetIdeal: [300_000, 500_000] as [number, number], // USD
  budgetCeiling: 550_000,
  preferredZones: ['horqueta', 'santa rita', 'lomas', 'martinez', 'acassuso', 'beccar'], // barrios que suman (normalizado)
  topZones: ['horqueta', 'santa rita', 'lomas'], // los que más les cierran
  minRoomsProxy: 4,   // ambientes ~ 3 dormitorios
  idealTerreno: 300,  // m² total
}

function norm(s?: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// Amenities desde el título (best-effort — no hay descripción).
const RX = {
  pileta: /pileta|piscina/i,
  parrilla: /parrilla|quincho/i,
  jardin: /jard[ií]n|parque|fondo|verde/i,
  luminoso: /luminos|luz natural/i,
  norte: /\bnorte\b/i,
  cerrado: /country|barrio cerrado|cerrado/i,
  refaccionar: /recicl|refacci|demoler|a reformar|a poner en valor/i,
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface MarketStats {
  byBarrio: Map<string, { median: number; n: number }>
  globalMedian: number
}

/** $/m² mediano por barrio (mínimo de muestra) + mediano global, sobre casas con precio. */
export function computeMarketStats(properties: Property[]): MarketStats {
  const casas = properties.filter(p => isScorable(p) && p.pricePerM2)
  const byBarrioVals = new Map<string, number[]>()
  for (const p of casas) {
    const k = norm(p.neighborhood) || '(sin barrio)'
    const arr = byBarrioVals.get(k) ?? []
    arr.push(p.pricePerM2!)
    byBarrioVals.set(k, arr)
  }
  const byBarrio = new Map<string, { median: number; n: number }>()
  for (const [k, vals] of byBarrioVals) {
    if (vals.length >= 5) byBarrio.set(k, { median: median(vals), n: vals.length })
  }
  return { byBarrio, globalMedian: median(casas.map(p => p.pricePerM2!)) }
}

/** Una casa entra al scoring si es casa con precio y m² (ML/ZonaProp). */
export function isScorable(p: Property): boolean {
  return (p.propertyType ?? 'casa') !== 'ph'
    && typeof p.price === 'number' && p.price > 0
    && !!(p.m2Total || p.m2Covered)
    && p.currency !== 'ARS'
    && !p.discontinuedAt
}

export interface OppResult {
  score: number          // 0-100
  reasons: string[]      // el "por qué", legible
  pctVsMarket?: number   // % vs mediana del barrio (negativo = más barato)
}

/** Puntúa una casa como oportunidad. Score 0-100 + razones. */
export function scoreOpportunity(p: Property, stats: MarketStats): OppResult {
  const reasons: string[] = []
  let score = 0
  const title = p.title ?? ''
  const hood = norm(p.neighborhood)

  // 1) $/m² vs barrio (la señal más fuerte)
  let pctVsMarket: number | undefined
  if (p.pricePerM2) {
    const base = stats.byBarrio.get(hood)?.median || stats.globalMedian
    if (base > 0) {
      pctVsMarket = Math.round(((p.pricePerM2 - base) / base) * 100)
      if (pctVsMarket <= -25) { score += 40; reasons.push(`$/m² ${-pctVsMarket}% bajo el promedio del barrio`) }
      else if (pctVsMarket <= -10) { score += 28; reasons.push(`$/m² ${-pctVsMarket}% bajo el promedio del barrio`) }
      else if (pctVsMarket <= -3) { score += 15; reasons.push(`$/m² algo bajo el promedio del barrio`) }
    }
  }

  // 2) Bajó de precio (historial)
  if (p.priceHistory && p.priceHistory.length >= 2) {
    const first = p.priceHistory[0].price, last = p.priceHistory[p.priceHistory.length - 1].price
    if (last < first) {
      const drop = Math.round(((first - last) / first) * 100)
      score += Math.min(20, drop * 1.5)
      reasons.push(`bajó ${drop}% desde que se publicó`)
    }
  }

  // 3) Zona preferida
  if (PREFS.topZones.some(z => hood.includes(z))) { score += 16; reasons.push('zona top (La Horqueta/Santa Rita/Las Lomas)') }
  else if (PREFS.preferredZones.some(z => hood.includes(z))) { score += 8; reasons.push(`zona preferida (${p.neighborhood})`) }

  // 4) Presupuesto
  const [lo, hi] = PREFS.budgetIdeal
  if (p.price! >= lo && p.price! <= hi) { score += 14; reasons.push('dentro del presupuesto ideal') }
  else if (p.price! < lo) { score += 6 }
  else if (p.price! > PREFS.budgetCeiling) { score -= 18; reasons.push('por encima del techo (~500k)') }

  // 5) Criterios de la casa
  if ((p.rooms ?? 0) >= PREFS.minRoomsProxy) { score += 10; reasons.push(`${p.rooms} ambientes`) }
  if ((p.m2Total ?? 0) > PREFS.idealTerreno) { score += 10; reasons.push(`terreno ${p.m2Total} m²`) }

  // 6) Amenities desde el título (best-effort)
  if (RX.jardin.test(title)) { score += 5; reasons.push('menciona jardín') }
  if (RX.pileta.test(title)) { score += 5; reasons.push('pileta') }
  if (RX.parrilla.test(title)) { score += 3; reasons.push('parrilla/quincho') }
  if (RX.luminoso.test(title) || RX.norte.test(title)) { score += 5; reasons.push('luminosa / orientación norte') }
  if (RX.cerrado.test(title)) { score += 3; reasons.push('barrio cerrado/country') }
  if (RX.refaccionar.test(title)) { reasons.push('a refaccionar (posible upside)') }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, pctVsMarket }
}

/** Devuelve las casas rankeadas por oportunidad (con score y razones), top primero. */
export function rankOpportunities(properties: Property[]): Array<Property & { opp: OppResult }> {
  const stats = computeMarketStats(properties)
  return properties
    .filter(isScorable)
    .map(p => ({ ...p, opp: scoreOpportunity(p, stats) }))
    .filter(p => p.opp.score >= 30 && p.opp.reasons.length > 0)
    .sort((a, b) => b.opp.score - a.opp.score)
}
