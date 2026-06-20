import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getDoses, getAllSubs, deleteSub } from '@/lib/db'
import { arDate, arSlot } from '@/lib/time'

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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')

  // Solo el cron de Vercel (que manda el Bearer con CRON_SECRET) puede disparar
  // notificaciones reales. La prueba manual se hace con una notificación local
  // desde el cliente (ver botón "Probar notificación" en la app).
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else if (process.env.VERCEL) {
    // En producción sin CRON_SECRET no podemos verificar el origen: cerramos.
    return NextResponse.json({ error: 'cron sin CRON_SECRET configurado' }, { status: 503 })
  }

  if (!initVapid()) {
    return NextResponse.json({ error: 'VAPID no configurado' }, { status: 500 })
  }

  const today = arDate()
  const slot  = arSlot()
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
