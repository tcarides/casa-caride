import { useEffect, useState } from 'react'
import type { ExtractedData, Property, PropertyStatus } from '../shared/types'
import { getAllProperties, saveProperty, updateStatus, deleteProperty, makeId } from '../shared/storage'

// ─── Tipos de vistas ────────────────────────────────────────────────────────

type View = 'current' | 'saved'

// ─── Utils ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  if (!price) return 'Precio no disponible'
  return `${currency === 'USD' ? 'USD' : '$'} ${price.toLocaleString('es-AR')}`
}

function sourceLabel(source: string): string {
  return { zonaprop: 'ZonaProp', argenprob: 'ArgenProp', mercadolibre: 'MercadoLibre' }[source] ?? source
}

function sourceBadgeColor(source: string): string {
  return {
    zonaprop: '#2563eb',
    argenprob: '#16a34a',
    mercadolibre: '#f59e0b',
  }[source] ?? '#6b7280'
}

function statusIcon(status: PropertyStatus): string {
  return { unseen: '👁️', seen: '✓', favorite: '★', discarded: '✗' }[status]
}

// ─── Estilos inline (sin Tailwind en popup para simplificar) ─────────────────

const s = {
  header: {
    background: '#1e40af',
    color: 'white',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    background: 'white',
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    borderBottom: active ? '2px solid #1e40af' : '2px solid transparent',
    color: active ? '#1e40af' : '#64748b',
    fontSize: 12,
  }),
  card: {
    background: 'white',
    borderRadius: 8,
    padding: 12,
    margin: '8px 10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    background: color,
    color: 'white',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 6,
  }),
  title: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 1.3,
  } as React.CSSProperties,
  price: {
    color: '#1e40af',
    fontWeight: 700,
    fontSize: 16,
    marginBottom: 4,
  } as React.CSSProperties,
  meta: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 2,
  } as React.CSSProperties,
  chips: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
    marginTop: 6,
    marginBottom: 6,
  },
  chip: {
    background: '#f1f5f9',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 11,
    color: '#475569',
  } as React.CSSProperties,
  btn: (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    background: variant === 'primary' ? '#1e40af' : variant === 'danger' ? '#dc2626' : '#f1f5f9',
    color: variant === 'primary' || variant === 'danger' ? 'white' : '#475569',
  }),
  photosRow: {
    display: 'flex',
    gap: 4,
    overflowX: 'auto' as const,
    marginBottom: 8,
  },
  photo: {
    width: 72,
    height: 54,
    objectFit: 'cover' as const,
    borderRadius: 4,
    flexShrink: 0,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: 6,
    fontSize: 12,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    marginTop: 6,
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  empty: {
    textAlign: 'center' as const,
    color: '#94a3b8',
    padding: '30px 20px',
  },
}

// ─── Componente: detalle de la propiedad actual ───────────────────────────────

function CurrentPropertyView({ extracted, onSaved }: {
  extracted: ExtractedData | null
  onSaved: () => void
}) {
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  async function handleSave() {
    if (!extracted) return
    setSaving(true)
    const now = new Date().toISOString()
    const property: Property = {
      ...extracted,
      id: makeId(extracted.source, extracted.externalId),
      status: 'seen',
      notes: notes.trim() || undefined,
      savedAt: now,
      updatedAt: now,
    }
    await saveProperty(property)
    setSaved(true)
    setSaving(false)
    onSaved()
  }

  if (!extracted) {
    return (
      <div style={s.empty}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Navegá a una propiedad</div>
        <div style={{ fontSize: 11 }}>ZonaProp · ArgenProp · MercadoLibre</div>
      </div>
    )
  }

  return (
    <div style={s.card}>
      <span style={s.badge(sourceBadgeColor(extracted.source))}>
        {sourceLabel(extracted.source)}
      </span>

      {extracted.photos.length > 0 && (
        <div style={s.photosRow}>
          {extracted.photos.slice(0, 8).map((url, i) => (
            <img
              key={i}
              src={url}
              style={{ ...s.photo, opacity: i === photoIdx ? 1 : 0.7, cursor: 'pointer' }}
              onClick={() => setPhotoIdx(i)}
              alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ))}
        </div>
      )}

      <div style={s.title}>{extracted.title || 'Sin título'}</div>
      <div style={s.price}>{formatPrice(extracted.price, extracted.currency)}</div>

      {extracted.address && <div style={s.meta}>📍 {extracted.address}</div>}
      {extracted.neighborhood && <div style={s.meta}>🏘️ {extracted.neighborhood}</div>}

      <div style={s.chips}>
        {extracted.rooms && <span style={s.chip}>🛏 {extracted.rooms} amb.</span>}
        {extracted.bathrooms && <span style={s.chip}>🚿 {extracted.bathrooms} baños</span>}
        {extracted.m2Total && <span style={s.chip}>📐 {extracted.m2Total} m²</span>}
        {extracted.m2Covered && <span style={s.chip}>🏗 {extracted.m2Covered} m² cub.</span>}
        {extracted.garages && <span style={s.chip}>🚗 {extracted.garages} coch.</span>}
        {extracted.expenses && (
          <span style={s.chip}>
            Expensas: {extracted.currency === 'ARS' ? '$' : 'USD'} {extracted.expenses.toLocaleString('es-AR')}
          </span>
        )}
      </div>

      <textarea
        style={s.textarea}
        rows={2}
        placeholder="Notas rápidas (opcional)..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />

      <div style={s.actions}>
        {saved ? (
          <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>✓ Guardada</span>
        ) : (
          <button style={s.btn('primary')} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : '★ Guardar propiedad'}
          </button>
        )}
        <button
          style={s.btn('ghost')}
          onClick={() => chrome.tabs.create({ url: extracted.url })}
        >
          Abrir
        </button>
      </div>
    </div>
  )
}

// ─── Componente: listado de guardadas ─────────────────────────────────────────

const STATUS_FILTERS: Array<{ label: string; value: PropertyStatus | 'all' }> = [
  { label: 'Todas', value: 'all' },
  { label: '★ Favoritas', value: 'favorite' },
  { label: '✓ Vistas', value: 'seen' },
  { label: '👁 Sin ver', value: 'unseen' },
]

function SavedPropertiesView() {
  const [properties, setProperties] = useState<Property[]>([])
  const [filter, setFilter] = useState<PropertyStatus | 'all'>('all')

  async function load() {
    const all = await getAllProperties()
    setProperties(all)
  }

  useEffect(() => { load() }, [])

  async function handleStatus(id: string, status: PropertyStatus) {
    await updateStatus(id, status)
    load()
  }

  async function handleDelete(id: string) {
    await deleteProperty(id)
    load()
  }

  const filtered = filter === 'all' ? properties : properties.filter(p => p.status === filter)

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            style={{
              ...s.btn('ghost'),
              background: filter === f.value ? '#1e40af' : '#f1f5f9',
              color: filter === f.value ? 'white' : '#475569',
              padding: '3px 8px',
              fontSize: 11,
            }}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11, alignSelf: 'center' }}>
          {filtered.length} prop.
        </span>
      </div>

      {filtered.length === 0 && (
        <div style={s.empty}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
          <div>No hay propiedades {filter !== 'all' ? `con estado "${filter}"` : 'guardadas'}</div>
        </div>
      )}

      {filtered.map(p => (
        <div key={p.id} style={{ ...s.card, opacity: p.status === 'discarded' ? 0.5 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={s.badge(sourceBadgeColor(p.source))}>{sourceLabel(p.source)}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {new Date(p.savedAt).toLocaleDateString('es-AR')}
            </span>
          </div>

          {p.photos[0] && (
            <img
              src={p.photos[0]}
              style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
              alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}

          <div style={s.title}>{p.title || 'Sin título'}</div>
          <div style={s.price}>{formatPrice(p.price, p.currency)}</div>
          {p.address && <div style={s.meta}>📍 {p.address}</div>}

          <div style={s.chips}>
            {p.rooms && <span style={s.chip}>🛏 {p.rooms}</span>}
            {p.m2Total && <span style={s.chip}>📐 {p.m2Total} m²</span>}
            {p.bathrooms && <span style={s.chip}>🚿 {p.bathrooms}</span>}
          </div>

          {p.notes && (
            <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 4, padding: '4px 8px', fontSize: 11, marginBottom: 6 }}>
              📝 {p.notes}
            </div>
          )}

          <div style={s.actions}>
            <button
              title="Favorita"
              style={{ ...s.btn('ghost'), background: p.status === 'favorite' ? '#fef9c3' : undefined }}
              onClick={() => handleStatus(p.id, p.status === 'favorite' ? 'seen' : 'favorite')}
            >★</button>
            <button
              title="Vista"
              style={{ ...s.btn('ghost'), background: p.status === 'seen' ? '#dcfce7' : undefined }}
              onClick={() => handleStatus(p.id, 'seen')}
            >✓</button>
            <button
              title="Descartar"
              style={{ ...s.btn('ghost'), background: p.status === 'discarded' ? '#fee2e2' : undefined }}
              onClick={() => handleStatus(p.id, p.status === 'discarded' ? 'unseen' : 'discarded')}
            >✗</button>
            <button style={s.btn('ghost')} onClick={() => chrome.tabs.create({ url: p.url })}>
              Abrir
            </button>
            <button style={{ ...s.btn('danger'), marginLeft: 'auto' }} onClick={() => handleDelete(p.id)}>
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Popup principal ──────────────────────────────────────────────────────────

export function Popup() {
  const [view, setView] = useState<View>('current')
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    // Preguntar al background qué propiedad está activa en el tab actual
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_PROPERTY' }, (response) => {
      if (response?.data) setExtracted(response.data)
    })

    // Contar guardadas
    getAllProperties().then(all => setSavedCount(all.length))
  }, [])

  function handleSaved() {
    getAllProperties().then(all => setSavedCount(all.length))
  }

  return (
    <>
      <div style={s.header}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🏠 Compra Casa</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>San Isidro</span>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(view === 'current')} onClick={() => setView('current')}>
          {extracted ? '✦ ' : ''}Esta propiedad
        </button>
        <button style={s.tab(view === 'saved')} onClick={() => setView('saved')}>
          Guardadas {savedCount > 0 && `(${savedCount})`}
        </button>
      </div>

      {view === 'current'
        ? <CurrentPropertyView extracted={extracted} onSaved={handleSaved} />
        : <SavedPropertiesView />
      }
    </>
  )
}
