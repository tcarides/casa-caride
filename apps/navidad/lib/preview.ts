// Preview de links (Open Graph + JSON-LD): dado un link de producto, trae
// imagen, título y precio leyendo las meta tags y el JSON-LD de la página.
// Corre en el server. Guardas anti-SSRF: solo http/https, sin hosts internos,
// con timeout y tope de bytes.

export interface LinkPreview {
  image: string | null
  title: string | null
  price: number | null // centavos
  moneda: 'ARS' | 'USD' | null
}

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '[::1]', 'metadata.google.internal'])

/** Rechaza hosts internos / loopback / rangos privados por IP literal. */
function hostAllowed(host: string): boolean {
  const h = host.toLowerCase()
  if (BLOCKED_HOSTS.has(h)) return false
  if (h.endsWith('.local') || h.endsWith('.internal')) return false
  // IPv4 literal → bloquear loopback / privados / link-local.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 127 || a === 10 || a === 0) return false
    if (a === 169 && b === 254) return false // link-local / metadata
    if (a === 192 && b === 168) return false
    if (a === 172 && b >= 16 && b <= 31) return false
  }
  if (h.startsWith('[')) return false // IPv6 literal → no lo soportamos
  return true
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    // property|name|itemprop = "og:image" ... content="..." (cualquier orden)
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
      'i',
    )
    const tag = html.match(re)?.[0]
    if (tag) {
      const c = tag.match(/content=["']([^"']*)["']/i)?.[1]
      if (c) return decodeEntities(c.trim())
    }
  }
  return null
}

function linkHref(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  return tag ? (tag.match(/href=["']([^"']+)["']/i)?.[1] ?? null) : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, '/')
}

// ── JSON-LD (schema.org Product) ──
interface LdPick { name?: string; image?: string; price?: number; currency?: string }

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) { for (const x of v) { const s = firstString(x); if (s) return s } return undefined }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return firstString(o.url) ?? firstString(o.contentUrl)
  }
  return undefined
}

// ¿Es el nodo del producto? (y no Organization/WebSite/BreadcrumbList, que en
// MercadoLibre traen name "Mercado Libre" + el logo y ensucian el preview).
function isProductNode(o: Record<string, unknown>): boolean {
  const t = o['@type']
  const typeMatch = typeof t === 'string'
    ? /product/i.test(t)
    : Array.isArray(t) && t.some((x) => typeof x === 'string' && /product/i.test(x))
  return typeMatch || o.offers != null
}

function pickFromNode(node: unknown, out: LdPick): void {
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  if (!isProductNode(o)) return // solo del producto: evita logo/nombre del sitio
  if (!out.name && typeof o.name === 'string') out.name = o.name
  if (!out.image) { const img = firstString(o.image); if (img) out.image = img }
  const offersRaw = o.offers
  const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as Record<string, unknown> | undefined
  if (offer && out.price == null) {
    const spec = (offer.priceSpecification && typeof offer.priceSpecification === 'object'
      ? (Array.isArray(offer.priceSpecification) ? offer.priceSpecification[0] : offer.priceSpecification)
      : undefined) as Record<string, unknown> | undefined
    const p = offer.price ?? offer.lowPrice ?? spec?.price
    const n = p == null ? NaN : Number(String(p).replace(/[^\d.]/g, ''))
    if (Number.isFinite(n)) out.price = n
    const c = offer.priceCurrency ?? spec?.priceCurrency
    if (typeof c === 'string') out.currency = c
  }
}

function parseJsonLd(html: string): LdPick {
  const out: LdPick = {}
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let data: unknown
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const roots = Array.isArray(data) ? data : [data]
    for (const root of roots) {
      const graph = root && typeof root === 'object' && '@graph' in root
        ? (root as Record<string, unknown>)['@graph']
        : null
      const nodes = Array.isArray(graph) ? graph : [root]
      for (const node of nodes) pickFromNode(node, out)
      if (out.name && out.image && out.price != null) return out
    }
  }
  return out
}

export async function fetchPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!hostAllowed(url.hostname)) return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // UA de navegador real: muchos sitios (MercadoLibre, etc.) devuelven
        // una página genérica o sin datos a clientes que parecen bots.
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'es-AR,es;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) return null
    const ctype = res.headers.get('content-type') ?? ''
    if (!ctype.includes('html')) return null

    // Tope de bytes: con el <head> y el JSON-LD alcanza.
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let total = 0
    const MAX = 1024 * 1024
    while (total < MAX) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    try { await reader.cancel() } catch { /* noop */ }
    const finalUrl = (() => { try { return new URL(res.url || url.toString()) } catch { return url } })()
    const html = new TextDecoder('utf-8').decode(concat(chunks))
    const ld = parseJsonLd(html)

    const image = absolutize(
      metaContent(html, ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'])
      ?? ld.image
      ?? linkHref(html, 'image_src'),
      finalUrl,
    )
    const ogTitle = metaContent(html, ['og:title', 'twitter:title'])
    // Si el og:title es genérico (el nombre del sitio), preferimos el nombre
    // del producto del JSON-LD.
    const generico = !ogTitle || /^(mercado\s*libre|mercadolibre|amazon.*)$/i.test(ogTitle.trim())
    const title =
      (generico ? (ld.name ?? ogTitle) : ogTitle)
      ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
      ?? null

    const amount = metaContent(html, ['og:price:amount', 'product:price:amount', 'product:price', 'price'])
    const currency = metaContent(html, ['og:price:currency', 'product:price:currency', 'priceCurrency'])
    let price = amount ? parseAmount(amount) : null
    if (price == null && ld.price != null) price = Math.round(ld.price * 100)
    const moneda = pickMoneda(currency ?? ld.currency ?? null)

    if (!image && !title && price == null) return null
    return { image, title, price, moneda }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function pickMoneda(c: string | null): 'ARS' | 'USD' | null {
  if (!c) return null
  const u = c.toUpperCase()
  if (u.includes('USD') || u.includes('US$') || u.includes('U$S')) return 'USD'
  if (u.includes('ARS') || u.includes('$')) return 'ARS'
  return null
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}

function absolutize(src: string | null | undefined, base: URL): string | null {
  if (!src) return null
  try { return new URL(src, base).toString() } catch { return null }
}

/** "1.999,00" / "1999.00" / "$1999" → centavos. */
function parseAmount(s: string): number | null {
  const clean = s.replace(/[^\d.,]/g, '')
  if (!clean) return null
  // Si tiene coma como separador decimal (es-AR), normalizar.
  const normalized = clean.includes(',') && clean.lastIndexOf(',') > clean.lastIndexOf('.')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
