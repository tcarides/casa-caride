import { NextResponse } from 'next/server'
import { currentEmail } from '@/lib/identity'
import { getContactos } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Todos mis contactos con los grupos donde figura cada uno (vista Contactos).
export async function GET() {
  const email = await currentEmail()
  if (!email) return NextResponse.json([])
  return NextResponse.json(await getContactos(email))
}
