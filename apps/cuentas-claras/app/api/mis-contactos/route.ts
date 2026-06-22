import { NextResponse } from 'next/server'
import { currentEmail } from '@/lib/identity'
import { getMisContactos } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Mis contactos para sumar a una cuenta: miembros de los grupos que comparto.
export async function GET() {
  const email = await currentEmail()
  if (!email) return NextResponse.json([])
  return NextResponse.json(await getMisContactos(email))
}
