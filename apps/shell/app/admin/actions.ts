'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { addUser, deleteUser, setAppAccess } from '@/lib/db'

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
