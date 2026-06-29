import { NextResponse } from 'next/server'
import { esName } from '@/lib/fixture-teams'

export const dynamic = 'force-dynamic'

interface FdMatch {
  status: string
  homeTeam: { name: string | null }
  awayTeam: { name: string | null }
  // winner refleja el resultado real, penales incluidos (HOME_TEAM/AWAY_TEAM/DRAW).
  score: { winner: string | null; fullTime: { home: number | null; away: number | null } }
}

interface FdMatchesResponse {
  matches: FdMatch[]
}

export async function GET() {
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) {
    return NextResponse.json({ source: 'static', reason: 'no-key' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
      { headers: { 'X-Auth-Token': key }, cache: 'no-store' },
    )

    if (!res.ok) {
      return NextResponse.json({ source: 'static', reason: 'fd-' + res.status }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const raw = (await res.json()) as FdMatchesResponse
    const results = (raw.matches ?? [])
      .filter(m =>
        m.homeTeam?.name && m.awayTeam?.name &&
        m.score?.fullTime?.home != null && m.score?.fullTime?.away != null,
      )
      .map(m => ({
        home: esName(m.homeTeam.name as string),
        away: esName(m.awayTeam.name as string),
        homeScore: m.score.fullTime.home as number,
        awayScore: m.score.fullTime.away as number,
        // 'home' | 'away' | null — quién avanza (penales incluidos). Lo usa el
        // bracket para propagar el ganador de cada llave a la ronda siguiente.
        winner: m.score.winner === 'HOME_TEAM' ? 'home'
              : m.score.winner === 'AWAY_TEAM' ? 'away' : null,
      }))

    return NextResponse.json(
      { source: 'live', updatedAt: new Date().toISOString(), results },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } },
    )
  } catch {
    return NextResponse.json({ source: 'static', reason: 'excepcion' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
