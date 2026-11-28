import assert from 'node:assert/strict'
import test from 'node:test'
import {
  matchesAdmin,
  openViewAs,
  overlayViewer,
  readonlyMessage,
  sealViewAs,
  shouldBlockWrite,
  viewAsWriteBlock,
} from './index.ts'

const SECRET = 'test-secret-casa-caride'

const clara = {
  adminEmail: 'tomascaride@gmail.com',
  email: 'clara@example.com',
  name: 'Clara',
  role: 'member' as const,
  userId: null,
}

test('sella y abre, y rechaza firma o secreto distintos', async () => {
  const token = await sealViewAs(clara, SECRET)
  const opened = await openViewAs(token, SECRET)
  assert.equal(opened.ok, true)
  if (!opened.ok) return
  assert.equal(opened.view.email, 'clara@example.com')
  assert.equal(opened.view.name, 'Clara')
  assert.equal(matchesAdmin(opened.view, 'TomasCaride@gmail.com', 'admin'), true)
  assert.equal(matchesAdmin(opened.view, 'clara@example.com', 'member'), false)

  assert.equal((await openViewAs(token + 'x', SECRET)).ok, false)
  assert.equal((await openViewAs(token, 'otro')).ok, false)
  assert.equal((await openViewAs(undefined, SECRET)).reason, 'missing')
})

test('un nombre con acento sobrevive el viaje', async () => {
  const token = await sealViewAs({ ...clara, name: 'Tomás' }, SECRET)
  const opened = await openViewAs(token, SECRET)
  assert.equal(opened.ok, true)
  if (opened.ok) assert.equal(opened.view.name, 'Tomás')
})

test('expira', async () => {
  const token = await sealViewAs({ ...clara, exp: Date.now() - 1000 }, SECRET)
  const opened = await openViewAs(token, SECRET)
  assert.equal(opened.ok, false)
  assert.equal(opened.reason, 'expired')
  assert.equal(opened.view?.email, 'clara@example.com')
})

test('solo un admin matcheado cambia de identidad', async () => {
  const token = await sealViewAs(clara, SECRET)
  const admin = { email: 'tomascaride@gmail.com', name: 'Tomás', role: 'admin', userId: 'tomi' }
  const flori = { email: 'florencia.pastorini@gmail.com', name: 'Flori', role: 'member', userId: 'flori' }
  const asClara = await overlayViewer(admin, token, SECRET)
  assert.equal(asClara.email, 'clara@example.com')
  assert.equal(asClara.role, 'member')
  assert.equal(asClara.userId, null)
  const stayed = await overlayViewer(flori, token, SECRET)
  assert.equal(stayed.email, flori.email)
  assert.equal(stayed.userId, 'flori')
  const noSecret = await overlayViewer(admin, token, undefined)
  assert.equal(noSecret.email, admin.email)
})

test('bloquea escrituras y deja pasar la navegación y el salir', async () => {
  const h = (map: Record<string, string>) => (name: string) => map[name.toLowerCase()] ?? map[name] ?? null
  assert.equal(shouldBlockWrite('GET', '/navidad/api/grupos', h({})), false)
  assert.equal(shouldBlockWrite('POST', '/navidad/api/grupos', h({})), true)
  assert.equal(shouldBlockWrite('DELETE', '/api/grupos/1', h({})), true)
  assert.equal(shouldBlockWrite('POST', '/api/view-as/stop', h({})), false)
  assert.equal(shouldBlockWrite('POST', '/api/session/logout/', h({})), false)
  assert.equal(shouldBlockWrite('POST', '/navidad', h({ rsc: '1' })), false)
  assert.equal(shouldBlockWrite('POST', '/navidad', h({ rsc: '1', 'next-action': 'abc' })), true)

  const token = await sealViewAs(clara, SECRET)
  const blocked = await viewAsWriteBlock({
    method: 'POST', pathname: '/navidad/api/grupos', cookie: token, secret: SECRET, header: h({}),
  })
  assert.equal(blocked?.code, 'view_as_readonly')
  assert.match(blocked?.error ?? '', /Clara/)
  assert.match(readonlyMessage('Clara'), /No podés crear, editar ni borrar/)

  const passed = await viewAsWriteBlock({
    method: 'GET', pathname: '/navidad/api/grupos', cookie: token, secret: SECRET, header: h({}),
  })
  assert.equal(passed, null)

  const junk = await viewAsWriteBlock({
    method: 'POST', pathname: '/api/grupos', cookie: 'no-es-valida', secret: SECRET, header: h({}),
  })
  assert.equal(junk, null)
})
