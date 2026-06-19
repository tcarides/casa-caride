import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TEAM: Record<string, { name: string; flag: string }> = {
  'Mexico': { name: 'México', flag: '🇲🇽' },
  'Korea Republic': { name: 'Corea del Sur', flag: '🇰🇷' },
  'South Korea': { name: 'Corea del Sur', flag: '🇰🇷' },
  'Czech Republic': { name: 'Rep. Checa', flag: '🇨🇿' },
  'Czechia': { name: 'Rep. Checa', flag: '🇨🇿' },
  'South Africa': { name: 'Sudáfrica', flag: '🇿🇦' },
  'Canada': { name: 'Canadá', flag: '🇨🇦' },
  'Switzerland': { name: 'Suiza', flag: '🇨🇭' },
  'Bosnia and Herzegovina': { name: 'Bosnia y Herz.', flag: '🇧🇦' },
  'Qatar': { name: 'Qatar', flag: '🇶🇦' },
  'Brazil': { name: 'Brasil', flag: '🇧🇷' },
  'Morocco': { name: 'Marruecos', flag: '🇲🇦' },
  'Scotland': { name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  'Haiti': { name: 'Haití', flag: '🇭🇹' },
  'USA': { name: 'EE.UU.', flag: '🇺🇸' },
  'United States': { name: 'EE.UU.', flag: '🇺🇸' },
  'Australia': { name: 'Australia', flag: '🇦🇺' },
  'Turkey': { name: 'Turquía', flag: '🇹🇷' },
  'Türkiye': { name: 'Turquía', flag: '🇹🇷' },
  'Paraguay': { name: 'Paraguay', flag: '🇵🇾' },
  'Germany': { name: 'Alemania', flag: '🇩🇪' },
  "Côte d'Ivoire": { name: 'Costa de Marfil', flag: '🇨🇮' },
  "Cote d'Ivoire": { name: 'Costa de Marfil', flag: '🇨🇮' },
  'Ivory Coast': { name: 'Costa de Marfil', flag: '🇨🇮' },
  'Ecuador': { name: 'Ecuador', flag: '🇪🇨' },
  'Curaçao': { name: 'Curazao', flag: '🇨🇼' },
  'Curacao': { name: 'Curazao', flag: '🇨🇼' },
  'Netherlands': { name: 'Países Bajos', flag: '🇳🇱' },
  'Japan': { name: 'Japón', flag: '🇯🇵' },
  'Sweden': { name: 'Suecia', flag: '🇸🇪' },
  'Tunisia': { name: 'Túnez', flag: '🇹🇳' },
  'Spain': { name: 'España', flag: '🇪🇸' },
  'Cape Verde': { name: 'Cabo Verde', flag: '🇨🇻' },
  'Saudi Arabia': { name: 'Arabia Saudita', flag: '🇸🇦' },
  'Uruguay': { name: 'Uruguay', flag: '🇺🇾' },
  'Belgium': { name: 'Bélgica', flag: '🇧🇪' },
  'Egypt': { name: 'Egipto', flag: '🇪🇬' },
  'Iran': { name: 'Irán', flag: '🇮🇷' },
  'New Zealand': { name: 'Nueva Zelanda', flag: '🇳🇿' },
  'France': { name: 'Francia', flag: '🇫🇷' },
  'Senegal': { name: 'Senegal', flag: '🇸🇳' },
  'Iraq': { name: 'Irak', flag: '🇮🇶' },
  'Norway': { name: 'Noruega', flag: '🇳🇴' },
  'Argentina': { name: 'Argentina', flag: '🇦🇷' },
  'Austria': { name: 'Austria', flag: '🇦🇹' },
  'Jordan': { name: 'Jordania', flag: '🇯🇴' },
  'Algeria': { name: 'Argelia', flag: '🇩🇿' },
  'Colombia': { name: 'Colombia', flag: '🇨🇴' },
  'Portugal': { name: 'Portugal', flag: '🇵🇹' },
  'DR Congo': { name: 'RD Congo', flag: '🇨🇩' },
  'Congo DR': { name: 'RD Congo', flag: '🇨🇩' },
  'Democratic Republic of Congo': { name: 'RD Congo', flag: '🇨🇩' },
  'Uzbekistan': { name: 'Uzbekistán', flag: '🇺🇿' },
  'England': { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Ghana': { name: 'Ghana', flag: '🇬🇭' },
  'Panama': { name: 'Panamá', flag: '🇵🇦' },
  'Croatia': { name: 'Croacia', flag: '🇭🇷' },
}

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
