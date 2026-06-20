// Hora de Argentina (UTC-3 fijo, sin horario de verano).
// Compartido por el cliente (app/page.tsx) y el cron (api/cron/notify).
export const AR_OFFSET_MS = 3 * 60 * 60 * 1000

/** "Ahora" desplazado a la hora de Argentina, para leerlo con métodos UTC. */
export function arNow(): Date {
  return new Date(Date.now() - AR_OFFSET_MS)
}

/** Fecha de Argentina en formato YYYY-MM-DD, opcionalmente N días hacia atrás. */
export function arDate(offsetDays = 0): string {
  return new Date(Date.now() - AR_OFFSET_MS - offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/** Franja del día en Argentina: 'am' antes del mediodía, 'pm' después. */
export function arSlot(): 'am' | 'pm' {
  return arNow().getUTCHours() < 12 ? 'am' : 'pm'
}
