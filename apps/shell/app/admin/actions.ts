'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import {
  addUser, deleteUser, setAppAccess, createInvite, deleteInvite,
} from '@/lib/db'
import { APPS } from '../apps.config'

// Todas las acciones de admin se re-validan server-side (no alcanza con que el
// middleware gatee la página: los server actions se pueden invocar directo).
async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') throw new Error('No autorizado')
}

export async function toggleAccess(formData: FormData) {
  await requireAdmin()
  const email = String(formData.get('email') ?? '')
  const app = String(formData.get('app') ?? '')
  const enabled = formData.get('enabled') === 'true'
  if (email && app) await setAppAccess(email, app, enabled)
  revalidatePath('/admin')
}

export async function createUser(formData: FormData) {
  await requireAdmin()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const role = formData.get('role') === 'admin' ? 'admin' : 'member'
  if (!email || !name) return
  await addUser(email, name, role)
  revalidatePath('/admin')
}

export async function removeUser(formData: FormData) {
  await requireAdmin()
  const email = String(formData.get('email') ?? '')
  if (email) await deleteUser(email)
  revalidatePath('/admin')
}

export async function newInvite(formData: FormData) {
  const session = await auth()
  if (session?.user?.role !== 'admin') throw new Error('No autorizado')
  const note = String(formData.get('note') ?? '').trim() || 'Invitado/a'
  // Apps tildadas: checkboxes con name="app" y value=slug.
  const apps = formData.getAll('app').map(String).filter((s) => APPS.some((a) => a.slug === s))
  // "multi" tildado → link para varias personas (ilimitado hasta vencer); si no, 1 persona.
  const maxUsos = formData.get('multi') ? 0 : 1
  await createInvite(note, apps, session.user.email ?? '', maxUsos)
  revalidatePath('/admin')
}

export async function removeInvite(formData: FormData) {
  await requireAdmin()
  const token = String(formData.get('token') ?? '')
  if (token) await deleteInvite(token)
  revalidatePath('/admin')
}
