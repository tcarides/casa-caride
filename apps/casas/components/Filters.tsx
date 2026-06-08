'use client'

import type { Filters, PropertyStatus } from '@/lib/types'

const PARTIDOS = ['San Isidro', 'San Fernando']
const BARRIOS = [
  // San Isidro
  'Martínez', 'Acassuso', 'Beccar', 'Boulogne', 'Villa Adelina', 'Lomas de San Isidro', 'La Horqueta', 'Santa Rita',
  // San Fernando
  'Victoria', 'Virreyes', 'Punta Chica',
]
const TIPOS = ['casa', 'ph']
const TIPO_LABELS: Record<string, string> = { casa: 'Casa', ph: 'PH' }

const PRICE_RANGES = [
  { label: '0–200k',  min: '',       max: '200000' },
  { label: '200–300k', min: '200000', max: '300000' },
  { label: '300–400k', min: '300000', max: '400000' },
  { label: '400–500k', min: '400000', max: '500000' },
  { label: '+500k',   min: '500000', max: '' },
]
const SOURCES = ['zonaprop', 'argenprob', 'mercadolibre']
const SOURCE_LABELS: Record<string, string> = {
  zonaprop: 'ZonaProp',
  argenprob: 'ArgenProp',
  mercadolibre: 'MercadoLibre',
}
const STATUSES: PropertyStatus[] = ['unseen', 'seen', 'maybe', 'favorite', 'discarded']
const STATUS_LABELS: Record<PropertyStatus, string> = {
  unseen: 'Sin ver',
  seen: 'Vista',
  maybe: 'Quizás',
  favorite: 'Favorita',
  discarded: 'Descartada',
}

interface Props {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  total: number
  shown: number
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        active
          ? 'bg-accent-600 border-accent-500 text-white'
          : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function Filters({ filters, onChange, total, shown }: Props) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <div className="text-slate-400 text-xs mb-1">Búsqueda</div>
        <input
          type="text"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          placeholder="Barrio, dirección..."
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Partido</div>
        <div className="flex flex-wrap gap-1">
          {PARTIDOS.map(z => (
            <Toggle
              key={z}
              active={filters.zona.includes(z)}
              onClick={() => onChange({ zona: toggleArr(filters.zona, z) })}
            >
              {z}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Barrio / Localidad</div>
        <div className="flex flex-wrap gap-1">
          {BARRIOS.map(z => (
            <Toggle
              key={z}
              active={filters.zona.includes(z)}
              onClick={() => onChange({ zona: toggleArr(filters.zona, z) })}
            >
              {z}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Tipo</div>
        <div className="flex flex-wrap gap-1">
          {TIPOS.map(t => (
            <Toggle
              key={t}
              active={filters.tipo.includes(t)}
              onClick={() => onChange({ tipo: toggleArr(filters.tipo, t) })}
            >
              {TIPO_LABELS[t]}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Estado (mío)</div>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(s => (
            <Toggle
              key={s}
              active={filters.status.includes(s)}
              onClick={() => onChange({ status: toggleArr(filters.status, s) })}
            >
              {STATUS_LABELS[s]}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Compartido</div>
        <Toggle
          active={filters.favBoth}
          onClick={() => onChange({ favBoth: !filters.favBoth })}
        >
          ★ Fav de ambos
        </Toggle>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">No publicadas</div>
        <div className="flex flex-wrap gap-1">
          <Toggle active={filters.discontinued === 'show'} onClick={() => onChange({ discontinued: 'show' })}>
            Mostrar
          </Toggle>
          <Toggle active={filters.discontinued === 'hide'} onClick={() => onChange({ discontinued: 'hide' })}>
            Ocultar
          </Toggle>
          <Toggle active={filters.discontinued === 'only'} onClick={() => onChange({ discontinued: 'only' })}>
            Solo estas
          </Toggle>
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Duplicadas</div>
        <Toggle
          active={filters.hideDuplicates}
          onClick={() => onChange({ hideDuplicates: !filters.hideDuplicates })}
        >
          Ocultar duplicadas
        </Toggle>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-1">Fuente</div>
        <div className="flex flex-wrap gap-1">
          {SOURCES.map(s => (
            <Toggle
              key={s}
              active={filters.source.includes(s)}
              onClick={() => onChange({ source: toggleArr(filters.source, s) })}
            >
              {SOURCE_LABELS[s]}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-2">Precio USD</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {PRICE_RANGES.map(r => {
            const active = filters.priceMin === r.min && filters.priceMax === r.max
            return (
              <button
                key={r.label}
                onClick={() => onChange(active ? { priceMin: '', priceMax: '' } : { priceMin: r.min, priceMax: r.max })}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  active
                    ? 'bg-accent-600 border-accent-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.priceMin}
            onChange={e => onChange({ priceMin: e.target.value })}
            placeholder="Mín"
            className="w-1/2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
          />
          <input
            type="number"
            value={filters.priceMax}
            onChange={e => onChange({ priceMax: e.target.value })}
            placeholder="Máx"
            className="w-1/2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-2">M² total</div>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.m2Min}
            onChange={e => onChange({ m2Min: e.target.value })}
            placeholder="Mín"
            className="w-1/2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
          />
          <input
            type="number"
            value={filters.m2Max}
            onChange={e => onChange({ m2Max: e.target.value })}
            placeholder="Máx"
            className="w-1/2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-2">Ambientes mín.</div>
        <input
          type="number"
          value={filters.roomsMin}
          onChange={e => onChange({ roomsMin: e.target.value })}
          placeholder="Ej: 3"
          min={1}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
        />
      </div>

      <button
        onClick={() => onChange({
          zona: [],
          tipo: [],
          source: [],
          status: [],
          favBoth: false,
          discontinued: 'show',
          hideDuplicates: true,
          priceMin: '',
          priceMax: '',
          m2Min: '',
          m2Max: '',
          roomsMin: '',
          search: '',
        })}
        className="text-xs text-slate-500 hover:text-slate-300 underline text-left"
      >
        Limpiar filtros
      </button>

      <div className="text-xs text-slate-500 mt-auto pt-2 border-t border-slate-700">
        {shown} / {total} propiedades
      </div>
    </div>
  )
}
