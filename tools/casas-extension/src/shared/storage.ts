import type { Property, PropertyStatus } from './types'

const STORAGE_KEY = 'compra_casa_properties'

export async function getAllProperties(): Promise<Property[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as Property[]) ?? []
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const all = await getAllProperties()
  return all.find(p => p.id === id)
}

export async function saveProperty(property: Property): Promise<void> {
  const all = await getAllProperties()
  const existingIndex = all.findIndex(p => p.id === property.id)

  if (existingIndex >= 0) {
    // Actualizar manteniendo status/notes del existente si ya estaba guardado
    all[existingIndex] = {
      ...all[existingIndex],
      ...property,
      status: all[existingIndex].status,
      notes: all[existingIndex].notes,
      updatedAt: new Date().toISOString(),
    }
  } else {
    all.unshift(property) // Las nuevas van al principio
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: all })
}

export async function updateStatus(id: string, status: PropertyStatus): Promise<void> {
  const all = await getAllProperties()
  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) return
  all[idx].status = status
  all[idx].updatedAt = new Date().toISOString()
  await chrome.storage.local.set({ [STORAGE_KEY]: all })
}

export async function updateNotes(id: string, notes: string): Promise<void> {
  const all = await getAllProperties()
  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) return
  all[idx].notes = notes
  all[idx].updatedAt = new Date().toISOString()
  await chrome.storage.local.set({ [STORAGE_KEY]: all })
}

export async function deleteProperty(id: string): Promise<void> {
  const all = await getAllProperties()
  const filtered = all.filter(p => p.id !== id)
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered })
}

export function makeId(source: string, externalId: string): string {
  return `${source}:${externalId}`
}
