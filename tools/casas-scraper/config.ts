/**
 * Configuración de búsqueda — editá esto según tus criterios
 */
export const config = {
  // ─── ZonaProp ──────────────────────────────────────────────────────────────
  zonaprop: {
    enabled: true,
    // URLs de búsqueda. La paginación se agrega automáticamente: -pagina-2.html, etc.
    // Tipo inferido de la URL: "ph-venta" → ph, "casas-venta" → casa
    searchUrls: [
      'https://www.zonaprop.com.ar/casas-venta-san-isidro.html',
      'https://www.zonaprop.com.ar/casas-venta-san-fernando.html',
      'https://www.zonaprop.com.ar/ph-venta-san-isidro.html',
      'https://www.zonaprop.com.ar/ph-venta-san-fernando.html',
    ],
    maxPages: 10,
  },

  // ─── ArgenProp ─────────────────────────────────────────────────────────────
  argenprob: {
    enabled: true,
    // Tipo inferido de la URL: "/ph/" → ph, "/casas/" → casa.
    // partido-de-* cubre todo el partido (las URLs sin "partido-de-" redirigen ahí).
    searchUrls: [
      'https://www.argenprop.com/casas/venta/partido-de-san-isidro',
      'https://www.argenprop.com/casas/venta/partido-de-san-fernando',
      'https://www.argenprop.com/ph/venta/partido-de-san-isidro',
      'https://www.argenprop.com/ph/venta/partido-de-san-fernando',
    ],
    // ArgenProp corta la paginación en la página 100 (~1980 avisos). Si una
    // categoría supera eso (casas SI = 2724), se parte por rango de precio.
    maxPages: 100,
  },

  // ─── MercadoLibre ──────────────────────────────────────────────────────────
  mercadolibre: {
    enabled: true,
    // Tipo inferido de la URL: "/ph/" → ph, "/casas/" → casa
    // ML reorganizó las URLs: ahora incluyen la región (bsas-gba-norte) y usa
    // ?skipInApp=true&matt_ignore=true para saltar el interstitial/anti-bot.
    searchUrls: [
      'https://inmuebles.mercadolibre.com.ar/casas/venta/bsas-gba-norte/san-isidro/?skipInApp=true&matt_ignore=true',
      'https://inmuebles.mercadolibre.com.ar/casas/venta/bsas-gba-norte/san-fernando/?skipInApp=true&matt_ignore=true',
      'https://inmuebles.mercadolibre.com.ar/ph/venta/bsas-gba-norte/san-isidro/?skipInApp=true&matt_ignore=true',
      'https://inmuebles.mercadolibre.com.ar/ph/venta/bsas-gba-norte/san-fernando/?skipInApp=true&matt_ignore=true',
    ],
    // ML tiene ~2389 casas en SI solo; pagina de a 48 y corta ~item 2000 (≈42 págs)
    maxPages: 42,
  },

  // ─── Comportamiento del scraper ────────────────────────────────────────────
  scraper: {
    // Delay entre requests para no sobrecargar los servidores (ms)
    delayBetweenRequests: 1500,
    // Si solo hay propiedades ya conocidas en una página, para de paginar
    stopOnAllKnown: true,
  },
}
