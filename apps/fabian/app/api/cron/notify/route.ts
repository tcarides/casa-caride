import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getDoses, getAllSubs, deleteSub } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Configura las claves VAPID en tiempo de request (no de build): si se hace a
// nivel módulo, Next lo evalúa durante `next build` y rompe cuando todavía no
// están seteadas las env vars.
function initVapid(): boolean {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return true
}

// Argentina = UTC-3 fijo
function arNow() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')

  // Solo el cron de Vercel (que manda el Bearer con CRON_SECRET) puede disparar
  // notificaciones reales. La prueba manual se hace con una notificación local
  // desde el cliente (ver botón "Probar notificación" en la app).
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!initVapid()) {
    return NextResponse.json({ error: 'VAPID no configurado' }, { status: 500 })
  }

  const now   = arNow()
  const today = now.toISOString().slice(0, 10)
  const slot  = now.getUTCHours() < 12 ? 'am' : 'pm'
  const label = slot === 'am' ? 'mañana 🌅' : 'noche 🌙'

  const doses   = await getDoses(today, today)
  const already = doses.find(d => d.date === today && d.slot === slot)
  if (already) {
    return NextResponse.json({ skipped: true, reason: 'already given' })
  }

  const subs = await getAllSubs()
  if (subs.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no subscribers' })
  }

  const payload = JSON.stringify({
    title: '¿Te acordaste de darle la pastilla? 🐶',
    body:  `Hora de la dosis de ${label}. ¿Quién se la da?`,
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
