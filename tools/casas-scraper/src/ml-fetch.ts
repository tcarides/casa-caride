/**
 * Fetch específico para MercadoLibre.
 *
 * ML protege la búsqueda de inmuebles con dos capas:
 *  1. Un challenge proof-of-work ("anubis"): el server setea una cookie
 *     `_bmstate=nonce;dificultad;...` y el cliente debe encontrar un `r` tal que
 *     sha256(nonce + r) empiece con N ceros, devolviendo `_bmc=nonce;r`.
 *  2. Un muro de cuenta verificada: tras pasar el PoW, si no hay sesión válida
 *     redirige (302) a /gz/account-verification.
 *
 * Por eso necesitamos las cookies de una sesión logueada. Se cargan desde
 * `scraper/.ml-cookies.txt` (una sola línea con el header Cookie completo) o
 * desde la env var ML_COOKIE. El PoW se resuelve acá automáticamente.
 *
 * Para evitar problemas de escaping en Windows (las cookies tienen muchos `%`),
 * usamos un archivo de config de curl (`curl -K`).
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

let warnedNoCookie = false

/** Instrucciones paso a paso para refrescar las cookies de ML. */
export const ML_COOKIE_HELP = `
═══════════════════════════════════════════════════════════════════════
  ⚠️  MercadoLibre necesita tus cookies de sesión (se renuevan cada ~días).

  Cómo obtenerlas (2 min):
   1. Abrí Chrome YA LOGUEADO en mercadolibre.com.ar
   2. Entrá a:
      https://inmuebles.mercadolibre.com.ar/casas/venta/bsas-gba-norte/san-isidro/
      → confirmá que VES los listados (no una pantalla de "verificación").
   3. F12 (DevTools) → pestaña "Network" → recargá con F5
   4. Click en la 1ª request de la lista (el documento, "san-isidro/")
   5. Andá a "Headers" → sección "Request Headers" → buscá la línea "Cookie:"
   6. Copiá TODO el valor (es largo) — NO uses document.cookie en la consola
      (ese no trae las cookies de login).
   7. Pegalo en UNA SOLA LÍNEA en el archivo:
        scraper/.ml-cookies.txt
   8. Volvé a correr el scrape.

  Nota: ZonaProp y ArgenProp NO necesitan cookies; igual se actualizan.
═══════════════════════════════════════════════════════════════════════
`

/**
 * Preflight: valida que la sesión de ML sirva. Imprime el paso a paso si faltan
 * o expiraron las cookies. Devuelve true si está OK para scrapear.
 */
export async function preflightMl(): Promise<boolean> {
  if (!loadSessionCookie()) {
    console.warn(ML_COOKIE_HELP)
    return false
  }
  const probe = await fetchMercadoLibrePage(
    'https://inmuebles.mercadolibre.com.ar/casas/venta/bsas-gba-norte/san-isidro/?skipInApp=true&matt_ignore=true',
  )
  if (!probe || !probe.includes('product_list')) {
    console.warn(ML_COOKIE_HELP)
    return false
  }
  console.log('[MercadoLibre] ✓ sesión válida (cookies OK)')
  return true
}

/** Carga las cookies de sesión desde archivo o env var. */
export function loadSessionCookie(): string | null {
  if (process.env.ML_COOKIE && process.env.ML_COOKIE.trim()) {
    return process.env.ML_COOKIE.trim()
  }
  const file = join(__dirname, '..', '.ml-cookies.txt')
  if (existsSync(file)) {
    const c = readFileSync(file, 'utf8').trim()
    if (c) return c
  }
  return null
}

/** Resuelve el proof-of-work a partir del valor de la cookie _bmstate. */
function solvePow(bmstateValue: string): string | null {
  const raw = decodeURIComponent(bmstateValue)
  const parts = raw.split(';')
  const nonce = parts[0]
  const diff = parseInt(parts[1], 10)
  if (!nonce || isNaN(diff)) return null
  const prefix = '0'.repeat(diff)
  for (let r = 0; r < 50_000_000; r++) {
    const h = createHash('sha256').update(nonce + String(r)).digest('hex')
    if (h.startsWith(prefix)) return encodeURIComponent(`${nonce};${r}`)
  }
  return null
}

function escapeForCurlConfig(value: string): string {
  // En config de curl, los valores entre comillas usan \ como escape.
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

interface CurlResult {
  status: number
  location: string | null
  setCookies: Record<string, string>
  body: string
}

/** Ejecuta una request con curl usando un archivo de config (evita escaping shell). */
async function curlOnce(url: string, cookieHeader: string): Promise<CurlResult> {
  const dir = mkdtempSync(join(tmpdir(), 'ml-'))
  const headerFile = join(dir, 'h.txt')
  const bodyFile = join(dir, 'b.html')
  const configFile = join(dir, 'curl.cfg')

  const cfg = [
    `url = "${escapeForCurlConfig(url)}"`,
    'silent',
    'compressed',
    'max-time = 25',
    `output = "${escapeForCurlConfig(bodyFile)}"`,
    `dump-header = "${escapeForCurlConfig(headerFile)}"`,
    `header = "User-Agent: ${UA}"`,
    `header = "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"`,
    `header = "Accept-Language: es-AR,es;q=0.9,en;q=0.8"`,
    `header = "sec-fetch-dest: document"`,
    `header = "sec-fetch-mode: navigate"`,
    `header = "Cookie: ${escapeForCurlConfig(cookieHeader)}"`,
  ].join('\n')
  writeFileSync(configFile, cfg, 'utf8')

  try {
    await execAsync(`curl -K "${configFile}"`, { maxBuffer: 50 * 1024 * 1024 })
    const headers = existsSync(headerFile) ? readFileSync(headerFile, 'utf8') : ''
    const body = existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : ''

    const status = parseInt(headers.match(/HTTP\/[\d.]+\s+(\d+)/)?.[1] ?? '0', 10)
    const location = headers.match(/^location:\s*(.+)$/im)?.[1]?.trim() ?? null
    const setCookies: Record<string, string> = {}
    for (const m of headers.matchAll(/^set-cookie:\s*([^=]+)=([^;]*)/gim)) {
      setCookies[m[1].trim()] = m[2].trim()
    }
    return { status, location, setCookies, body }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function mergeCookie(base: string, extra: Record<string, string>): string {
  const parts = base
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
  const seen = new Map<string, string>()
  for (const p of parts) {
    const i = p.indexOf('=')
    if (i > 0) seen.set(p.slice(0, i).trim(), p.slice(i + 1))
  }
  for (const [k, v] of Object.entries(extra)) seen.set(k, v)
  return [...seen.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * Descarga una página de MercadoLibre resolviendo el challenge PoW y usando
 * las cookies de sesión. Devuelve el HTML o null (con un warning explicativo).
 */
export async function fetchMercadoLibrePage(url: string): Promise<string | null> {
  const session = loadSessionCookie()
  if (!session) {
    if (!warnedNoCookie) {
      console.warn(
        '\n  ⚠️  MercadoLibre requiere sesión. Pegá tus cookies en scraper/.ml-cookies.txt\n' +
          '     (header Cookie completo de una sesión logueada en mercadolibre.com.ar).\n',
      )
      warnedNoCookie = true
    }
    return null
  }

  // 1) Primera request con las cookies de sesión.
  let res = await curlOnce(url, session)

  // 2) Si aparece el challenge PoW, resolverlo y reintentar.
  if (res.body.includes('continue-button') || res.setCookies['_bmstate']) {
    const bmstate = res.setCookies['_bmstate']
    if (bmstate) {
      const bmc = solvePow(bmstate)
      if (bmc) {
        const cookie = mergeCookie(session, {
          _bmstate: bmstate,
          _bmc: bmc,
          _bm_skipml: 'true',
        })
        res = await curlOnce(url, cookie)
      }
    }
  }

  // 3) Si redirige a verificación de cuenta → sesión inválida/expirada.
  if (res.status >= 300 && res.status < 400 && /account-verification/.test(res.location ?? '')) {
    console.warn(
      '\n  ⚠️  MercadoLibre redirige a account-verification: las cookies de sesión\n' +
        '     expiraron o no son válidas. Actualizá scraper/.ml-cookies.txt.\n',
    )
    return null
  }

  if (!res.body || res.body.length < 500) {
    console.warn(`  Respuesta muy corta de ML para ${url} (${res.body.length} bytes, status ${res.status})`)
    return null
  }

  return res.body
}
