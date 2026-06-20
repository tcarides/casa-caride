import { NextResponse } from 'next/server'
import { TEAM } from '@/lib/fixture-teams'

export const dynamic = 'force-dynamic'

function fmtDg(n: number): string {
  if (n > 0) return '+' + n
  return String(n)
}

interface StandingRow {
  team: { name: string }
  playedGames: number
  goalDifference: number
  points: number
}

interface GroupStanding {
  stage?: string
  type?: string
  group: string | null
  table: StandingRow[]
}

interface FdApiResponse {
  standings?: GroupStanding[]
  season?: { currentMatchday?: number }
}

export async function GET() {
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) {
    return NextResponse.json({ source: 'static', reason: 'no-key' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/standings', {
      headers: { 'X-Auth-Token': key },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ source: 'static', reason: 'fd-' + res.status }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const raw = (await res.json()) as FdApiResponse
    const all = raw.standings ?? []
    const standings = all.filter(s => s.group?.startsWith('GROUP_'))
    if (!standings.length) {
      const sample = all.slice(0, 2).map(s => (s.stage ?? '?') + '/' + (s.group ?? 'null')).join(',')
      const reason = 'sin-grupos len=' + all.length + (sample ? ' ' + sample : '')
      return NextResponse.json({ source: 'static', reason }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const groups = standings
      .map(s => ({
        id: (s.group as string).replace('GROUP_', ''),
        teams: (s.table ?? []).map(row => {
          const mapped = TEAM[row.team.name]
          return {
            name: mapped?.name ?? row.team.name,
            flag: mapped?.flag ?? '🏳',
            pj: row.playedGames,
            dg: fmtDg(row.goalDifference),
            pts: row.points,
            isArg: row.team.name === 'Argentina',
          }
        }),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json(
      { source: 'live', updatedAt: new Date().toISOString(), groups },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } },
    )
  } catch {
    return NextResponse.json({ source: 'static', reason: 'excepcion' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
