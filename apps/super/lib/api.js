// El basePath de esta zona (debe coincidir con `basePath` en next.config.mjs).
// Next.js prefija automáticamente los <Link> y la navegación, pero NO los
// fetch() manuales. Por eso anteponemos el basePath nosotros al llamar a la API.
export const BASE_PATH = "/super";

export function apiFetch(path, init) {
  return fetch(`${BASE_PATH}${path}`, init);
}
