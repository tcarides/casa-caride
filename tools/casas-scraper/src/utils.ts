import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Headers completos que simulan Chrome en Windows
export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'Upgrade-Insecure-Requests': '1',
}

/**
 * Extrae el objeto __NEXT_DATA__ del HTML de una página Next.js
 */
export function extractNextData(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

/**
 * Fetch usando curl — bypasea el TLS fingerprinting que bloquea Node.js fetch.
 * ZonaProp y ArgenProp bloquean Node fetch pero no curl.
 */
export async function fetchPage(url: string): Promise<string | null> {
  const headers = [
    `-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"`,
    `-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"`,
    `-H "Accept-Language: es-AR,es;q=0.9,en;q=0.8"`,
    `-H "sec-fetch-dest: document"`,
    `-H "sec-fetch-mode: navigate"`,
  ].join(' ')

  const cmd = `curl -s -L --max-time 20 --compressed ${headers} "${url}"`

  try {
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 })
    if (stderr && stderr.includes('curl: (')) {
      console.warn(`  curl error para ${url}: ${stderr.trim()}`)
      return null
    }
    if (!stdout || stdout.length < 500) {
      console.warn(`  Respuesta muy corta para ${url} (${stdout.length} bytes)`)
      return null
    }
    return stdout
  } catch (err) {
    console.warn(`  Error fetching ${url}:`, (err as Error).message)
    return null
  }
}

export function makeId(source: string, externalId: string): string {
  return `${source}:${externalId}`
}

export function parseNumber(val: unknown): number | undefined {
  const n = Number(String(val ?? '').replace(/[^\d.]/g, ''))
  return isNaN(n) || n === 0 ? undefined : n
}
