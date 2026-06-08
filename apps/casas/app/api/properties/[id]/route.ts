import { NextRequest, NextResponse } from 'next/server'
import { updateUserStatus, updateNotes, setDiscontinued } from '@/lib/db'
import type { PropertyStatus, UserId } from '@/lib/types'

const VALID_STATUSES: PropertyStatus[] = ['unseen', 'seen', 'maybe', 'favorite', 'discarded']
const VALID_USERS: UserId[] = ['tomi', 'flori']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)
  const body = await request.json() as { status?: string; notes?: string; userId?: string; discontinued?: boolean }

  // Toggle "no publicada" (property-level, no per-usuario)
  if (typeof body.discontinued === 'boolean') {
    if (!body.userId || !VALID_USERS.includes(body.userId as UserId)) {
      return NextResponse.json({ error: 'Missing or invalid userId for discontinued' }, { status: 400 })
    }
    const updated = await setDiscontinued(decodedId, body.discontinued, body.userId)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  // Notas → compartidas pero registramos quién editó
  if (typeof body.notes === 'string') {
    if (!body.userId || !VALID_USERS.includes(body.userId as UserId)) {
      return NextResponse.json({ error: 'Missing or invalid userId for notes' }, { status: 400 })
    }
    const updated = await updateNotes(decodedId, body.notes, body.userId as UserId)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  // Status → requiere userId
  if (body.status) {
    if (!VALID_STATUSES.includes(body.status as PropertyStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (!body.userId || !VALID_USERS.includes(body.userId as UserId)) {
      return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 })
    }
    const updated = await updateUserStatus(decodedId, body.userId as UserId, body.status as PropertyStatus)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'No status or notes provided' }, { status: 400 })
}
