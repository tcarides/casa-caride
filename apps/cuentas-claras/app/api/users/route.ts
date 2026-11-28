import { NextRequest, NextResponse } from 'next/server'
import { requireReady } from '@/lib/guard'
import { getCoGroupUsers, getUserAliases } from '@/lib/db'
import { fetchDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

type Dir = { name: string; email: string }

// Directorio para vincular un nombre libre con una cuenta. El shell ya se lo
// da a cualquier logueado (/api/directory). Si el shell no responde, quedan
// las personas con las que comparte un grupo.
export async function GET(req: NextRequest) {
  const ready = await requireReady(req)
  if ('res' in ready) return ready.res

  let list: Dir[] | null = await fetchDirectory(req.headers.get('cookie') ?? '')
  if (!list) list = await getCoGroupUsers(ready.user.email)

  const aliases = await getUserAliases()
  return NextResponse.json(
    list.map((u) => ({ ...u, alias: aliases[u.email.toLowerCase()] ?? null })),
  )
}
