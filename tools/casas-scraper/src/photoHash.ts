/**
 * Perceptual hash (dHash 64-bit) para fotos de propiedades.
 *
 * Algoritmo:
 *   1. Resize a 9x8 grayscale
 *   2. Por cada fila, comparar pixel actual con el siguiente
 *   3. 64 bits → string hex de 16 chars
 *
 * Hamming distance entre dos hashes = bits que difieren.
 *  ≤ 5  → casi seguro la misma foto
 *  ≤ 10 → muy probable la misma
 *  > 15 → probablemente distintas
 */
import sharp from 'sharp'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Descarga una imagen vía curl (más confiable que fetch para sites con TLS pinning).
 */
const IMG_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const cmd = `curl -s -L --max-time 15 -A "${IMG_UA}" -o - "${url}"`
    // Necesitamos buffer binario, no string
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 20 * 1024 * 1024,
      encoding: 'buffer',
    } as never)
    const buf = stdout as unknown as Buffer
    return buf.length > 100 ? buf : null
  } catch {
    return null
  }
}

export async function computeDHash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(imageBuffer)
      .resize(9, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let bits = ''
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col]
        const right = data[row * 9 + col + 1]
        bits += left < right ? '1' : '0'
      }
    }
    // Convertir 64 bits a 16 chars hex
    let hex = ''
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.substring(i, i + 4), 2).toString(16)
    }
    return hex
  } catch {
    return null
  }
}

export async function computeHashFromUrl(url: string): Promise<string | null> {
  const buf = await downloadImage(url)
  if (!buf) return null
  return computeDHash(buf)
}

/**
 * Hamming distance entre dos hex hashes.
 * Devuelve cuántos bits difieren (0 = idéntico, 64 = totalmente distinto).
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let count = 0
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    // popcount sobre 4 bits
    let v = xor
    while (v > 0) {
      count += v & 1
      v >>= 1
    }
  }
  return count
}
