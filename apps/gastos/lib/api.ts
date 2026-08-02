// Next NO prefija los fetch() manuales con el basePath (solo Link/next-image).
// Bajo /gastos, un fetch('/api/...') pegaría al apex y daría 404. Este helper
// antepone el basePath. USAR SIEMPRE apiFetch para llamar a la API de la zona.
const BASE = '/gastos'

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('/') ? `${BASE}${path}` : path
  return fetch(url, init)
}
