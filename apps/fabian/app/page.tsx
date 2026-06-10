'use client'

import { useCallback, useEffect, useState } from 'react'

type Caretaker = 'tomi' | 'flori'
type Slot = 'am' | 'pm'

interface Dose {
  date: string
  slot: Slot
  givenBy: Caretaker
  givenAt: string
}

const USER_KEY = 'fabian:user'
const NAMES: Record<Caretaker, string> = { tomi: 'Tomás', flori: 'Flori' }

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer as ArrayBuffer
}

// Argentina = UTC-3 fijo (no hay horario de verano)
function arDate(offsetDays = 0): string {
  const ms = Date.now() - 3 * 60 * 60 * 1000 - offsetDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function fmtDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const SLOTS: { slot: Slot; label: string; time: string; icon: string }[] = [
  { slot: 'am', label: 'Mañana', time: '8:30 AM', icon: '🌅' },
  { slot: 'pm', label: 'Noche',  time: '8:30 PM', icon: '🌙' },
]

export default function FabianPage() {
  const [user, setUser]         = useState<Caretaker | null>(null)
  const [userReady, setReady]   = useState(false)
  const [doses, setDoses]       = useState<Dose[]>([])
  const [saving, setSaving]     = useState<Slot | null>(null)
  const [notifState, setNotif]  = useState<'unsupported' | 'off' | 'on' | 'busy'>('unsupported')
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    const v = localStorage.getItem(USER_KEY)
    if (v === 'tomi' || v === 'flori') setUser(v)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setNotif(sub ? 'on' : 'off'))
    )
  }, [])

  async function toggleNotifications() {
    if (!user || notifState === 'unsupported' || notifState === 'busy') return
    setNotif('busy')
    try {
      const reg = await navigator.serviceWorker.ready

      if (notifState === 'on') {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await fetch('/fabian/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
        }
        setNotif('off')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setNotif('off'); return }

      const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!VAPID_KEY) { setNotif('off'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      })
      await fetch('/fabian/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userId: user }),
      })
      setNotif('on')
    } catch {
      setNotif('off')
    }
  }

  const fetchDoses = useCallback(async () => {
    const from = arDate(13)
    const to   = arDate(0)
    const res  = await fetch(`/fabian/api/doses?from=${from}&to=${to}`)
    if (res.ok) setDoses(await res.json() as Dose[])
  }, [])

  useEffect(() => {
    if (!user) return
    void fetchDoses()
    const t = setInterval(fetchDoses, 60_000)
    return () => clearInterval(t)
  }, [user, fetchDoses])

  function pickUser(u: Caretaker) {
    localStorage.setItem(USER_KEY, u)
    setUser(u)
  }

  async function toggle(slot: Slot) {
    if (!user || saving) return
    const date     = arDate(0)
    const existing = doses.find(d => d.date === date && d.slot === slot)
    const give     = !existing

    setSaving(slot)
    // Optimistic UI
    setDoses(prev =>
      give
        ? [...prev, { date, slot, givenBy: user, givenAt: new Date().toISOString() }]
        : prev.filter(d => !(d.date === date && d.slot === slot))
    )

    try {
      await fetch('/fabian/api/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, slot, user, given: give }),
      })
      await fetchDoses()   // sync server truth (handles concurrent updates)
    } catch {
      await fetchDoses()   // rollback on network error
    } finally {
      setSaving(null)
    }
  }

  if (!userReady) return null

  // ── User picker ────────────────────────────────────────────
  if (!user) {
    return (
      <div className="user-picker">
        <div className="user-picker-dog">🐶</div>
        <h1>Hola, ¿quién sos?</h1>
        <p>Para saber quién le dio la pastilla a Fabián.</p>
        <button className="user-btn" onClick={() => pickUser('tomi')}>
          <span className="user-btn-emoji">👨</span> Tomás
        </button>
        <button className="user-btn" onClick={() => pickUser('flori')}>
          <span className="user-btn-emoji">👩</span> Flori
        </button>
      </div>
    )
  }

  // ── Main UI ─────────────────────────────────────────────────
  const today = arDate(0)
  const doseKey = (d: string, s: Slot) => `${d}:${s}`
  const doseMap = new Map(doses.map(d => [doseKey(d.date, d.slot), d]))
  const history = Array.from({ length: 13 }, (_, i) => arDate(i + 1))

  return (
    <>
      <header className="fab-header">
        <div className="casa-headrow">
          <div className="fab-header-title">
            <span className="fab-header-dog">🐶</span>
            <div className="casa-title">
              <h1>¿Te acordaste de darle la pastilla?</h1>
              <p>Registrá que Fabián tomó sus medicinas</p>
            </div>
          </div>
        </div>
        <div className="fab-header-actions">
          {notifState !== 'unsupported' && (
            <button
              className={`fab-notif-btn${notifState === 'on' ? ' active' : ''}`}
              onClick={toggleNotifications}
              disabled={notifState === 'busy'}
              title={notifState === 'on' ? 'Desactivar notificaciones' : 'Activar notificaciones'}
              aria-label={notifState === 'on' ? 'Desactivar notificaciones' : 'Activar notificaciones'}
            >
              {notifState === 'on' ? '🔔' : '🔕'}
            </button>
          )}
          <button
            className="fab-user-btn"
            onClick={() => { localStorage.removeItem(USER_KEY); setUser(null) }}
            title="Cambiar usuario"
          >
            {NAMES[user]}
          </button>
        </div>
      </header>

      <div className="fab-body">
        {/* ── Hoy ── */}
        <div className="fab-label">Hoy</div>
        {SLOTS.map(({ slot, label, time, icon }) => {
          const dose = doseMap.get(doseKey(today, slot))
          const busy = saving === slot
          return (
            <div key={slot} className={`dose-card${dose ? ' done' : ''}`}>
              <div className="dose-top">
                <div className="dose-id">
                  <span className="dose-icon">{icon}</span>
                  <div>
                    <p className="dose-name">{label}</p>
                    <p className="dose-time">{time}</p>
                  </div>
                </div>
                <div className="dose-circle" aria-hidden>✓</div>
              </div>

              <div className="dose-bottom">
                {dose ? (
                  <span className="dose-who">
                    Le dio {NAMES[dose.givenBy]}
                    <span className="dose-when">{relTime(dose.givenAt)}</span>
                  </span>
                ) : (
                  <span className="dose-pending">Pendiente</span>
                )}
                <button
                  className={`dose-btn ${dose ? 'dose-btn-undo' : 'dose-btn-give'}`}
                  onClick={() => toggle(slot)}
                  disabled={busy}
                >
                  {busy ? '…' : dose ? 'Deshacer' : 'Yo lo di'}
                </button>
              </div>
            </div>
          )
        })}

        {/* ── Test notif ── */}
        {notifState === 'on' && (
          <div className="fab-test-row">
            <button
              className="fab-test-btn"
              disabled={testSent}
              onClick={async () => {
                setTestSent(true)
                try {
                  const reg = await navigator.serviceWorker.ready
                  await reg.showNotification('¿Te acordaste de darle la pastilla? 🐶', {
                    body: 'Las notificaciones funcionan correctamente.',
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'fabian-test',
                  })
                } catch {
                  /* sin permisos o SW no listo: el botón solo aparece con notifs activas */
                }
                setTimeout(() => setTestSent(false), 4000)
              }}
            >
              {testSent ? '✓ Enviada' : '🔔 Probar notificación'}
            </button>
          </div>
        )}

        {/* ── Historial ── */}
        {history.length > 0 && (
          <div className="fab-history">
            <div className="fab-label">Historial</div>
            {history.map(date => (
              <div key={date} className="history-row">
                <span className="history-date">{fmtDate(date)}</span>
                <div className="history-slots">
                  {SLOTS.map(({ slot, icon }) => {
                    const d = doseMap.get(doseKey(date, slot))
                    return (
                      <div key={slot} className={`history-slot${d ? ' done' : ''}`}>
                        <div className="hs-dot">✓</div>
                        <span className="hs-icon">{icon}</span>
                        {d && <span className="hs-who">{d.givenBy[0].toUpperCase()}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
