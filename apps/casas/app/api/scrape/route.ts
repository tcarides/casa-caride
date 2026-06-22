import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function POST() {
  const denied = await requireSession()
  if (denied) return denied
  try {
    const scraperDir = path.resolve(process.cwd(), '..', 'scraper')
    const { stdout, stderr } = await execAsync('npm run scrape', {
      cwd: scraperDir,
      timeout: 300000, // 5 minutes
    })

    const output = stdout + stderr
    // Sum up all "X nuevas" from per-page log lines
    const matches = [...output.matchAll(/(\d+) nueva/g)]
    const newCount = matches.reduce((acc, m) => acc + parseInt(m[1]), 0)

    return NextResponse.json({ success: true, newCount })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
