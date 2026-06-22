import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@/lib/identity'
import { getCoGroupUsers } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SHELL = 'https://casa-caride.vercel.app'

// Directorio para el selector de "usuario registrado" al armar un grupo:
//  - admin → todos los registrados (los pide al shell, reenviando la cookie).
//  - resto → solo con los que comparte algún grupo (se calcula acá).
export async function GET(req: NextRequest) {
  const me = await currentUser()
  if (!me) return NextResponse.json([], { status: 200 })

  if (me.role === 'admin') {
    try {
      const cookie = req.headers.get('cookie') ?? ''
      const r = await fetch(`${SHELL}/api/users`, { headers: { cookie }, cache: 'no-store' })
      if (r.ok) return NextResponse.json(await r.json())
    } catch {
      /* sin red / shell caído: caemos al listado por contexto */
    }
  }
  return NextResponse.json(await getCoGroupUsers(me.email))
}
