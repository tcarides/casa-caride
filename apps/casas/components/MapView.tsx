'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Property } from '@/lib/types'

// Fix de iconos default de Leaflet (rotos en Webpack/Next)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SOURCE_LABEL: Record<string, string> = {
  zonaprop: 'ZonaProp',
  argenprob: 'ArgenpProp',
  mercadolibre: 'MercadoLibre',
}

function fmt(n?: number) {
  if (!n) return '-'
  return n.toLocaleString('es-AR')
}

interface Props {
  properties: Property[]
}

// Auto-fit a bounds de los markers cuando cambian las propiedades
function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap()
  useEffect(() => {
    const points = properties
      .filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')
      .map(p => [p.lat!, p.lon!] as [number, number])
    if (points.length === 0) return
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
  }, [properties, map])
  return null
}

export default function MapView({ properties }: Props) {
  const withCoords = useMemo(
    () => properties.filter(p => typeof p.lat === 'number' && typeof p.lon === 'number'),
    [properties]
  )

  // Centro inicial: San Isidro (-34.473, -58.520)
  const center: [number, number] = [-34.473, -58.520]

  // Color según fuente
  const iconFor = useRef<Map<string, L.DivIcon>>(new Map())
  function getIcon(p: Property): L.DivIcon {
    const key = `${p.source}:${p.userStatus.tomi ?? ''}:${p.userStatus.flori ?? ''}`
    if (iconFor.current.has(key)) return iconFor.current.get(key)!

    let bg = '#475569'  // slate-600 default
    const fav = p.userStatus.tomi === 'favorite' || p.userStatus.flori === 'favorite'
    const both = p.userStatus.tomi === 'favorite' && p.userStatus.flori === 'favorite'
    if (both) bg = '#d97706'        // amber
    else if (fav) bg = '#ca8a04'    // amber darker
    else if (p.source === 'zonaprop') bg = '#0891b2'      // cyan
    else if (p.source === 'argenprob') bg = '#7c3aed'     // violet
    else if (p.source === 'mercadolibre') bg = '#eab308'  // yellow

    const html = `<div style="width:14px;height:14px;border-radius:50%;background:${bg};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5)"></div>`
    const icon = L.divIcon({ html, className: 'leaflet-prop-icon', iconSize: [18, 18], iconAnchor: [9, 9] })
    iconFor.current.set(key, icon)
    return icon
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%', background: '#1e293b' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds properties={withCoords} />
      {withCoords.map(p => {
        const priceStr = p.price ? `${p.currency === 'USD' ? 'USD' : '$'} ${fmt(p.price)}` : 'Sin precio'
        return (
          <Marker key={p.id} position={[p.lat!, p.lon!]} icon={getIcon(p)}>
            <Popup maxWidth={260}>
              <div style={{ fontFamily: 'system-ui', minWidth: 220 }}>
                {p.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photos[0]} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} loading="lazy" />
                )}
                <div style={{ fontWeight: 700, fontSize: 14 }}>{priceStr}</div>
                <div style={{ fontSize: 12, color: '#444', marginBottom: 4 }}>{p.address || p.neighborhood}</div>
                <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.m2Total && <span>{p.m2Total} m²</span>}
                  {p.rooms && <span>{p.rooms} amb.</span>}
                  <span style={{ marginLeft: 'auto' }}>{SOURCE_LABEL[p.source] ?? p.source}</span>
                </div>
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#2563eb' }}>
                  Ver publicación ↗
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
