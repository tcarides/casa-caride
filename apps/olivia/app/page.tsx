'use client'

import { useCallback, useEffect, useState } from 'react'

/* ─────────────────────────── Tipos ─────────────────────────── */
type Tab = 'resumen' | 'estudios' | 'turnos' | 'mediciones' | 'notas'
interface Config       { dueDate: string; babyName: string }
interface ChecklistItem { id: number; tri: string; text: string; done: boolean }
interface Estudio      { id: number; fecha: string; titulo: string; tipo: string; blobUrl: string; contentType: string; size: number }
interface Turno        { id: number; fecha: string; profesional: string; motivo: string; notas: string }
interface Medicion     { id: number; fecha: string; tipo: string; valor: string; unidad: string; notas: string }
interface Nota         { id: number; fecha: string; categoria: string; texto: string }

const API = '/olivia/api'
const PREGNANCY_DAYS = 280

/* ─────────────────────────── Helpers ─────────────────────────── */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function computeProgress(dueStr: string) {
  const due = new Date(dueStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const conception = new Date(due); conception.setDate(conception.getDate() - PREGNANCY_DAYS)
  const dayMs = 86_400_000
  const elapsed = Math.round((today.getTime() - conception.getTime()) / dayMs)
  const daysLeft = Math.max(Math.round((due.getTime() - today.getTime()) / dayMs), 0)
  const gest = Math.min(Math.max(elapsed, 0), 294)
  const week = Math.floor(gest / 7)
  const dayInWeek = gest % 7
  const pct = Math.min(Math.max((gest / PREGNANCY_DAYS) * 100, 0), 100)
  const trimester = week < 14 ? 1 : week < 28 ? 2 : 3
  return { week, dayInWeek, daysLeft, pct: Math.round(pct), trimester, due }
}

async function jpost(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'resumen',    label: 'Resumen',    icon: '🤰' },
  { id: 'estudios',   label: 'Estudios',   icon: '📄' },
  { id: 'turnos',     label: 'Turnos',     icon: '📅' },
  { id: 'mediciones', label: 'Mediciones', icon: '📊' },
  { id: 'notas',      label: 'Notas',      icon: '📝' },
]

/* ═══════════════════════════ App ═══════════════════════════ */
export default function OliviaPage() {
  const [tab, setTab] = useState<Tab>('resumen')

  return (
    <>
      <header className="ol-header">
        <div className="casa-headrow">
          <div className="ol-title">
            <span className="ol-dog">👶</span>
            <div className="casa-title">
              <h1>Olivia</h1>
              <p>Historia clínica del embarazo</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="ol-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`ol-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="ol-tab-icon">{t.icon}</span>
            <span className="ol-tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="ol-body">
        {tab === 'resumen'    && <ResumenTab />}
        {tab === 'estudios'   && <EstudiosTab />}
        {tab === 'turnos'     && <TurnosTab />}
        {tab === 'mediciones' && <MedicionesTab />}
        {tab === 'notas'      && <NotasTab />}
      </main>
    </>
  )
}

/* ─────────────────────────── Resumen ─────────────────────────── */
function ResumenTab() {
  const [config, setConfig] = useState<Config | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [editing, setEditing] = useState(false)
  const [newItem, setNewItem] = useState('')

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([
      fetch(`${API}/config`).then(r => r.json()),
      fetch(`${API}/checklist`).then(r => r.json()),
    ])
    setConfig(c); setChecklist(l)
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveConfig(dueDate: string, babyName: string) {
    const c = await fetch(`${API}/config`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate, babyName }),
    }).then(r => r.json())
    setConfig(c); setEditing(false)
  }

  async function toggle(item: ChecklistItem) {
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i))
    await fetch(`${API}/checklist`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, done: !item.done }),
    })
  }

  async function addItem() {
    const text = newItem.trim()
    if (!text) return
    const created = await jpost(`${API}/checklist`, { text, tri: '' }) as ChecklistItem
    setChecklist(prev => [...prev, created]); setNewItem('')
  }

  async function delItem(id: number) {
    setChecklist(prev => prev.filter(i => i.id !== id))
    await fetch(`${API}/checklist?id=${id}`, { method: 'DELETE' })
  }

  if (!config) return <div className="ol-loading">Cargando…</div>

  const p = computeProgress(config.dueDate)
  const done = checklist.filter(i => i.done).length
  const groups = [...new Set(checklist.map(i => i.tri))]

  return (
    <>
      {/* Cuenta regresiva */}
      <section className="ol-hero">
        <div className="ol-hero-top">
          <div>
            <span className="ol-hero-cap">Semana de embarazo</span>
            <span className="ol-hero-num">{p.week}</span>
            <span className="ol-hero-sub">{p.week} semanas y {p.dayInWeek} día{p.dayInWeek === 1 ? '' : 's'}</span>
          </div>
          <div className="ol-ring" style={{ ['--pct' as string]: `${p.pct}` }}>
            <span className="ol-ring-pct">{p.pct}%</span>
          </div>
        </div>
        <div className="ol-hero-stats">
          <div><span className="ol-stat-num">{p.daysLeft}</span><span className="ol-stat-cap">días para conocerla</span></div>
          <div><span className="ol-stat-num">{p.trimester}°</span><span className="ol-stat-cap">trimestre</span></div>
          <div><span className="ol-stat-num">{fmtDate(config.dueDate)}</span><span className="ol-stat-cap">fecha esperada</span></div>
        </div>
        <button className="ol-link-btn" onClick={() => setEditing(e => !e)}>
          {editing ? 'Cancelar' : 'Ajustar fecha'}
        </button>
        {editing && (
          <ConfigForm config={config} onSave={saveConfig} />
        )}
      </section>

      {/* Checklist */}
      <section className="ol-card">
        <div className="ol-card-head">
          <h2>📋 Preparativos</h2>
          <span className="ol-pill">{done}/{checklist.length}</span>
        </div>
        {groups.map(g => (
          <div key={g} className="ol-check-group">
            {g && <h3 className="ol-check-cap">{g}</h3>}
            {checklist.filter(i => i.tri === g).map(item => (
              <div key={item.id} className={`ol-check-item${item.done ? ' done' : ''}`}>
                <button className="ol-check-box" onClick={() => toggle(item)} aria-label={item.done ? 'Desmarcar' : 'Marcar'}>
                  {item.done ? '✓' : ''}
                </button>
                <span className="ol-check-text" onClick={() => toggle(item)}>{item.text}</span>
                <button className="ol-del" onClick={() => delItem(item.id)} aria-label="Borrar">×</button>
              </div>
            ))}
          </div>
        ))}
        <div className="ol-add-row">
          <input
            className="ol-input" placeholder="Agregar pendiente…"
            value={newItem} onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem() }}
          />
          <button className="ol-btn" onClick={addItem}>Agregar</button>
        </div>
      </section>
    </>
  )
}

function ConfigForm({ config, onSave }: { config: Config; onSave: (d: string, n: string) => void }) {
  const [due, setDue] = useState(config.dueDate)
  const [name, setName] = useState(config.babyName)
  return (
    <div className="ol-config-form">
      <label className="ol-field">
        <span>Fecha esperada</span>
        <input type="date" className="ol-input" value={due} onChange={e => setDue(e.target.value)} />
      </label>
      <label className="ol-field">
        <span>Nombre</span>
        <input type="text" className="ol-input" value={name} onChange={e => setName(e.target.value)} />
      </label>
      <button className="ol-btn" onClick={() => onSave(due, name)}>Guardar</button>
    </div>
  )
}

/* ─────────────────────────── Estudios ─────────────────────────── */
const TIPOS_ESTUDIO = ['Ecografía', 'Análisis', 'Informe', 'Otro']

function EstudiosTab() {
  const [items, setItems] = useState<Estudio[] | null>(null)
  const [fecha, setFecha] = useState(todayStr())
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState(TIPOS_ESTUDIO[0])
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setItems(await fetch(`${API}/estudios`).then(r => r.json()))
  }, [])
  useEffect(() => { void load() }, [load])

  async function submit() {
    if (!file || !titulo.trim()) { setError('Elegí un archivo y poné un título'); return }
    if (file.size > 4.4 * 1024 * 1024) {
      setError('El archivo supera los 4 MB. Sacale una foto con menos resolución o comprimí el PDF.')
      return
    }
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('fecha', fecha)
      fd.append('titulo', titulo.trim())
      fd.append('tipo', tipo)
      const res = await fetch(`${API}/estudios`, { method: 'POST', body: fd })
      if (!res.ok) {
        const msg = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(msg.error ?? `Error ${res.status}`)
      }
      setTitulo(''); setFile(null)
      const input = document.getElementById('ol-file') as HTMLInputElement | null
      if (input) input.value = ''
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally { setBusy(false) }
  }

  async function del(id: number) {
    if (!confirm('¿Borrar este estudio?')) return
    setItems(prev => prev?.filter(i => i.id !== id) ?? null)
    await fetch(`${API}/estudios?id=${id}`, { method: 'DELETE' })
  }

  return (
    <>
      <section className="ol-card">
        <div className="ol-card-head"><h2>📄 Subir estudio</h2></div>
        <div className="ol-form-grid">
          <label className="ol-field">
            <span>Fecha</span>
            <input type="date" className="ol-input" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
          <label className="ol-field">
            <span>Tipo</span>
            <select className="ol-input" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS_ESTUDIO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <label className="ol-field">
          <span>Título</span>
          <input className="ol-input" placeholder="Ej: Ecografía morfológica" value={titulo} onChange={e => setTitulo(e.target.value)} />
        </label>
        <label className="ol-field">
          <span>Archivo (imagen o PDF, hasta 4 MB)</span>
          <input id="ol-file" type="file" className="ol-input" accept="image/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="ol-error">{error}</p>}
        <button className="ol-btn ol-btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Subiendo…' : 'Subir estudio'}
        </button>
      </section>

      <section className="ol-card">
        <div className="ol-card-head"><h2>Estudios</h2><span className="ol-pill">{items?.length ?? 0}</span></div>
        {!items ? <div className="ol-loading">Cargando…</div>
          : items.length === 0 ? <p className="ol-empty">Todavía no hay estudios cargados.</p>
          : items.map(e => {
            const isImg = e.contentType.startsWith('image/')
            return (
              <a key={e.id} href={e.blobUrl} target="_blank" rel="noopener noreferrer" className="ol-estudio">
                <span className="ol-estudio-ic">{isImg ? '🖼️' : '📄'}</span>
                <span className="ol-estudio-main">
                  <span className="ol-estudio-tit">{e.titulo}</span>
                  <span className="ol-estudio-meta">{e.tipo} · {fmtDate(e.fecha)}{e.size ? ` · ${fmtSize(e.size)}` : ''}</span>
                </span>
                <button className="ol-del" onClick={ev => { ev.preventDefault(); del(e.id) }} aria-label="Borrar">×</button>
              </a>
            )
          })}
      </section>
    </>
  )
}

/* ─────────────────────────── Turnos ─────────────────────────── */
function TurnosTab() {
  const [items, setItems] = useState<Turno[] | null>(null)
  const [fecha, setFecha] = useState(() => `${todayStr()}T09:00`)
  const [prof, setProf] = useState('')
  const [motivo, setMotivo] = useState('')
  const [notas, setNotas] = useState('')

  const load = useCallback(async () => {
    setItems(await fetch(`${API}/turnos`).then(r => r.json()))
  }, [])
  useEffect(() => { void load() }, [load])

  async function add() {
    if (!fecha) return
    await jpost(`${API}/turnos`, { fecha, profesional: prof, motivo, notas })
    setProf(''); setMotivo(''); setNotas('')
    await load()
  }
  async function del(id: number) {
    setItems(prev => prev?.filter(i => i.id !== id) ?? null)
    await fetch(`${API}/turnos?id=${id}`, { method: 'DELETE' })
  }

  const now = new Date()

  return (
    <>
      <section className="ol-card">
        <div className="ol-card-head"><h2>📅 Nuevo turno</h2></div>
        <label className="ol-field">
          <span>Fecha y hora</span>
          <input type="datetime-local" className="ol-input" value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
        <label className="ol-field">
          <span>Profesional</span>
          <input className="ol-input" placeholder="Dr/a. …" value={prof} onChange={e => setProf(e.target.value)} />
        </label>
        <label className="ol-field">
          <span>Motivo</span>
          <input className="ol-input" placeholder="Control, ecografía, …" value={motivo} onChange={e => setMotivo(e.target.value)} />
        </label>
        <label className="ol-field">
          <span>Notas</span>
          <textarea className="ol-input ol-textarea" value={notas} onChange={e => setNotas(e.target.value)} />
        </label>
        <button className="ol-btn ol-btn-block" onClick={add}>Agregar turno</button>
      </section>

      <section className="ol-card">
        <div className="ol-card-head"><h2>Turnos</h2><span className="ol-pill">{items?.length ?? 0}</span></div>
        {!items ? <div className="ol-loading">Cargando…</div>
          : items.length === 0 ? <p className="ol-empty">No hay turnos cargados.</p>
          : items.map(t => {
            const futuro = new Date(t.fecha) >= now
            return (
              <div key={t.id} className={`ol-turno${futuro ? ' futuro' : ''}`}>
                <div className="ol-turno-main">
                  <span className="ol-turno-fecha">{fmtDateTime(t.fecha)}{futuro && <span className="ol-tag">próximo</span>}</span>
                  {(t.motivo || t.profesional) && <span className="ol-turno-tit">{[t.motivo, t.profesional].filter(Boolean).join(' · ')}</span>}
                  {t.notas && <span className="ol-turno-notas">{t.notas}</span>}
                </div>
                <button className="ol-del" onClick={() => del(t.id)} aria-label="Borrar">×</button>
              </div>
            )
          })}
      </section>
    </>
  )
}

/* ─────────────────────────── Mediciones ─────────────────────────── */
const TIPOS_MEDICION = [
  { tipo: 'Peso', unidad: 'kg' },
  { tipo: 'Presión', unidad: 'mmHg' },
  { tipo: 'Altura uterina', unidad: 'cm' },
  { tipo: 'Glucemia', unidad: 'mg/dl' },
  { tipo: 'Otro', unidad: '' },
]

function MedicionesTab() {
  const [items, setItems] = useState<Medicion[] | null>(null)
  const [fecha, setFecha] = useState(todayStr())
  const [tipo, setTipo] = useState(TIPOS_MEDICION[0].tipo)
  const [valor, setValor] = useState('')
  const [unidad, setUnidad] = useState(TIPOS_MEDICION[0].unidad)
  const [notas, setNotas] = useState('')

  const load = useCallback(async () => {
    setItems(await fetch(`${API}/mediciones`).then(r => r.json()))
  }, [])
  useEffect(() => { void load() }, [load])

  function pickTipo(t: string) {
    setTipo(t)
    const found = TIPOS_MEDICION.find(m => m.tipo === t)
    if (found) setUnidad(found.unidad)
  }

  async function add() {
    if (!valor.trim()) return
    await jpost(`${API}/mediciones`, { fecha, tipo, valor, unidad, notas })
    setValor(''); setNotas('')
    await load()
  }
  async function del(id: number) {
    setItems(prev => prev?.filter(i => i.id !== id) ?? null)
    await fetch(`${API}/mediciones?id=${id}`, { method: 'DELETE' })
  }

  return (
    <>
      <section className="ol-card">
        <div className="ol-card-head"><h2>📊 Nueva medición</h2></div>
        <div className="ol-form-grid">
          <label className="ol-field">
            <span>Fecha</span>
            <input type="date" className="ol-input" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
          <label className="ol-field">
            <span>Tipo</span>
            <select className="ol-input" value={tipo} onChange={e => pickTipo(e.target.value)}>
              {TIPOS_MEDICION.map(m => <option key={m.tipo} value={m.tipo}>{m.tipo}</option>)}
            </select>
          </label>
        </div>
        <div className="ol-form-grid">
          <label className="ol-field">
            <span>Valor</span>
            <input className="ol-input" placeholder="Ej: 68 o 12/8" value={valor} onChange={e => setValor(e.target.value)} />
          </label>
          <label className="ol-field">
            <span>Unidad</span>
            <input className="ol-input" value={unidad} onChange={e => setUnidad(e.target.value)} />
          </label>
        </div>
        <label className="ol-field">
          <span>Notas</span>
          <input className="ol-input" value={notas} onChange={e => setNotas(e.target.value)} />
        </label>
        <button className="ol-btn ol-btn-block" onClick={add}>Registrar</button>
      </section>

      <section className="ol-card">
        <div className="ol-card-head"><h2>Mediciones</h2><span className="ol-pill">{items?.length ?? 0}</span></div>
        {!items ? <div className="ol-loading">Cargando…</div>
          : items.length === 0 ? <p className="ol-empty">No hay mediciones registradas.</p>
          : items.map(m => (
            <div key={m.id} className="ol-medicion">
              <span className="ol-medicion-tipo">{m.tipo}</span>
              <span className="ol-medicion-valor">{m.valor} <small>{m.unidad}</small></span>
              <span className="ol-medicion-fecha">{fmtDate(m.fecha)}</span>
              <button className="ol-del" onClick={() => del(m.id)} aria-label="Borrar">×</button>
            </div>
          ))}
      </section>
    </>
  )
}

/* ─────────────────────────── Notas ─────────────────────────── */
const CATEGORIAS = ['Nota', 'Diagnóstico', 'Indicación', 'Medicación']

function NotasTab() {
  const [items, setItems] = useState<Nota[] | null>(null)
  const [fecha, setFecha] = useState(todayStr())
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [texto, setTexto] = useState('')

  const load = useCallback(async () => {
    setItems(await fetch(`${API}/notas`).then(r => r.json()))
  }, [])
  useEffect(() => { void load() }, [load])

  async function add() {
    if (!texto.trim()) return
    await jpost(`${API}/notas`, { fecha, categoria, texto })
    setTexto('')
    await load()
  }
  async function del(id: number) {
    setItems(prev => prev?.filter(i => i.id !== id) ?? null)
    await fetch(`${API}/notas?id=${id}`, { method: 'DELETE' })
  }

  return (
    <>
      <section className="ol-card">
        <div className="ol-card-head"><h2>📝 Nueva nota</h2></div>
        <div className="ol-form-grid">
          <label className="ol-field">
            <span>Fecha</span>
            <input type="date" className="ol-input" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
          <label className="ol-field">
            <span>Categoría</span>
            <select className="ol-input" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="ol-field">
          <span>Texto</span>
          <textarea className="ol-input ol-textarea" value={texto} onChange={e => setTexto(e.target.value)} />
        </label>
        <button className="ol-btn ol-btn-block" onClick={add}>Guardar nota</button>
      </section>

      <section className="ol-card">
        <div className="ol-card-head"><h2>Notas</h2><span className="ol-pill">{items?.length ?? 0}</span></div>
        {!items ? <div className="ol-loading">Cargando…</div>
          : items.length === 0 ? <p className="ol-empty">No hay notas todavía.</p>
          : items.map(n => (
            <div key={n.id} className="ol-nota">
              <div className="ol-nota-head">
                <span className="ol-nota-cat">{n.categoria}</span>
                <span className="ol-nota-fecha">{fmtDate(n.fecha)}</span>
                <button className="ol-del" onClick={() => del(n.id)} aria-label="Borrar">×</button>
              </div>
              <p className="ol-nota-texto">{n.texto}</p>
            </div>
          ))}
      </section>
    </>
  )
}
