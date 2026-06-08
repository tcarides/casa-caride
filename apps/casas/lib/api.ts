// El basePath de esta zona (debe coincidir con `basePath` en next.config.ts).
// Next.js prefija automáticamente los <Link> y la navegación, pero NO los
// fetch() manuales. Por eso anteponemos el basePath nosotros al llamar a la API.
export const BASE_PATH = '/casas'

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE_PATH}${path}`, init)
}
