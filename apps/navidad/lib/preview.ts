// Preview de links (Open Graph): dado un link de producto, trae imagen, título
// y precio leyendo las meta tags de la página. Se corre en el server. Guardas
// anti-SSRF: solo http/https, sin hosts internos, con timeout y tope de bytes.

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
    // property="og:image" content="..."  (en cualquier orden de atributos)
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, '/')
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
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Muchos sitios devuelven mejores OG tags con un UA de navegador.
        'user-agent': 'Mozilla/5.0 (compatible; CasaCarideBot/1.0; +https://casa-caride.vercel.app)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    const ctype = res.headers.get('content-type') ?? ''
    if (!ctype.includes('html')) return null

    // Tope de bytes: con el <head> alcanza para las meta tags.
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let total = 0
    const MAX = 512 * 1024
    while (total < MAX) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    try { await reader.cancel() } catch { /* noop */ }
    const html = new TextDecoder('utf-8').decode(concat(chunks))

    const image = absolutize(metaContent(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']), url)
    const title =
      metaContent(html, ['og:title', 'twitter:title']) ??
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
      null
    const amount = metaContent(html, ['og:price:amount', 'product:price:amount', 'product:price'])
    const currency = metaContent(html, ['og:price:currency', 'product:price:currency'])
    const price = amount ? parseAmount(amount) : null
    const moneda = currency === 'USD' ? 'USD' : currency === 'ARS' ? 'ARS' : null

    if (!image && !title && price == null) return null
    return { image, title, price, moneda }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}

function absolutize(src: string | null, base: URL): string | null {
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
