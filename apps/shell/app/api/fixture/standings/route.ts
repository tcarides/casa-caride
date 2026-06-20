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
  group: string
  table: StandingRow[]
}

interface FdApiResponse {
  standings: GroupStanding[]
}

export async function GET() {
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) {
    return NextResponse.json({ source: 'static' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/standings', {
      headers: { 'X-Auth-Token': key },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ source: 'static', error: res.status }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const raw = (await res.json()) as FdApiResponse
    const standings = (raw.standings ?? []).filter(s => s.group?.startsWith('GROUP_'))

    const groups = standings
      .map(s => ({
        id: s.group.replace('GROUP_', ''),
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
    return NextResponse.json({ source: 'static' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
