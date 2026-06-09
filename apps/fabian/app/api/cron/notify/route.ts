import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getDoses, getAllSubs, deleteSub } from '@/lib/db'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

// Argentina = UTC-3 fijo
function arNow() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  const auth  = req.headers.get('authorization')
  const force = req.nextUrl.searchParams.get('force') === 'true'

  // En modo test (force) no se requiere CRON_SECRET
  if (!force && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now   = arNow()
  const today = now.toISOString().slice(0, 10)
  const slot  = now.getUTCHours() < 12 ? 'am' : 'pm'
  const label = slot === 'am' ? 'mañana 🌅' : 'noche 🌙'

  if (!force) {
    const doses   = await getDoses(today, today)
    const already = doses.find(d => d.date === today && d.slot === slot)
    if (already) {
      return NextResponse.json({ skipped: true, reason: 'already given' })
    }
  }

  const subs = await getAllSubs()
  if (subs.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no subscribers' })
  }

  const payload = JSON.stringify({
    title: force ? '🔔 Notificación de prueba' : 'Pastilla de Fabián 🐶',
    body:  force ? 'Las notificaciones funcionan correctamente.' : `Hora de la dosis de ${label}. ¿Quién se la da?`,
    tag:   `fabian-${slot}-${today}`,
    url:   '/fabian',
  })

  const results = await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          payload,
        )
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) await deleteSub(sub.endpoint)
        throw err
      }
    })
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  return NextResponse.json({ sent, failed, slot, today })
}
