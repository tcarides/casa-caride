import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@/lib/identity'
import { getCoGroupUsers, getUserAliases } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SHELL = 'https://casa-caride.vercel.app'

type Dir = { name: string; email: string }

// Directorio para el selector de "usuario registrado" al armar un grupo:
//  - admin → todos los registrados (los pide al shell, reenviando la cookie).
//  - resto → solo con los que comparte algún grupo (se calcula acá).
// En ambos casos adjunta el alias guardado del usuario (para prellenarlo).
export async function GET(req: NextRequest) {
  const me = await currentUser()
  if (!me) return NextResponse.json([], { status: 200 })

  let list: Dir[] | null = null
  if (me.role === 'admin') {
    try {
      const cookie = req.headers.get('cookie') ?? ''
      const r = await fetch(`${SHELL}/api/users`, { headers: { cookie }, cache: 'no-store' })
      if (r.ok) list = (await r.json()) as Dir[]
    } catch {
      /* sin red / shell caído: caemos al listado por contexto */
    }
  }
  if (!list) list = await getCoGroupUsers(me.email)

  const aliases = await getUserAliases()
  return NextResponse.json(
    list.map((u) => ({ ...u, alias: aliases[u.email.toLowerCase()] ?? null })),
  )
}
