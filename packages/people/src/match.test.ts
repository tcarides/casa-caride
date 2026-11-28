import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageResource, canSeeResource } from './access.ts'
import { decideLink, planLinks } from './match.ts'

const USERS = [
  { email: 'tomascaride@gmail.com', name: 'Tomás' },
  { email: 'florencia.pastorini@gmail.com', name: 'Flori' },
  { email: 'clara.caride@holycross.edu.ar', name: 'Clara Caride' },
  { email: 'mariasilviasiritto@gmail.com', name: 'Maria Silvia Siritto' },
  { email: 'vicky.caride@gmail.com', name: 'Vicky Caride' },
]

test('Clari y Mamama se vinculan; los diminutivos no confirmados no', () => {
  const clari = decideLink('Clari', USERS)
  assert.equal(clari.status, 'linked')
  if (clari.status === 'linked') {
    assert.equal(clari.hit.email, 'clara.caride@holycross.edu.ar')
    assert.equal(clari.hit.reason, 'alias')
  }

  const mama = decideLink('Mamama', USERS)
  assert.equal(mama.status, 'linked')
  if (mama.status === 'linked') {
    assert.equal(mama.hit.email, 'mariasilviasiritto@gmail.com')
    assert.equal(mama.hit.reason, 'alias')
  }

  // El mail que se adivinó mal no alcanza: Mamama sale por el nombre.
  const soloMail = decideLink('Mamama', [
    { email: 'mariasiliviasiritto@gmail.com', name: 'Otra persona' },
  ])
  assert.equal(soloMail.status, 'unmatched')

  assert.equal(decideLink('Tomi', USERS).status, 'unmatched')
  assert.equal(decideLink('Florencia', USERS).status, 'unmatched')
  assert.equal(decideLink('Tío Juan', USERS).status, 'unmatched')
})

test('nombre completo, primer nombre único y prefijo de tokens', () => {
  assert.equal(decideLink('Vicky Caride', USERS).status, 'linked')
  const vicky = decideLink('Vicky', USERS)
  assert.equal(vicky.status, 'linked')
  if (vicky.status === 'linked') assert.equal(vicky.hit.reason, 'primer-nombre')

  const tomas = decideLink('Tomás', USERS)
  assert.equal(tomas.status, 'linked')
  if (tomas.status === 'linked') assert.equal(tomas.hit.email, 'tomascaride@gmail.com')

  const flori = decideLink('Flori', USERS)
  assert.equal(flori.status, 'linked')
  if (flori.status === 'linked') assert.equal(flori.hit.reason, 'nombre-completo')

  const parcial = decideLink('Maria Silvia', USERS)
  assert.equal(parcial.status, 'linked')
  if (parcial.status === 'linked') assert.equal(parcial.hit.reason, 'nombre-parcial')
})

test('no elige cuando hay más de un candidato', () => {
  const doubled = [
    ...USERS,
    { email: 'otra.siritto@gmail.com', name: 'Ana Siritto' },
    { email: 'juan1@gmail.com', name: 'Juan Pérez' },
    { email: 'juan2@gmail.com', name: 'Juan Gómez' },
  ]
  const mama = decideLink('Mamama', doubled)
  assert.equal(mama.status, 'ambiguous')
  if (mama.status === 'ambiguous') assert.equal(mama.candidates.length, 2)

  const juan = decideLink('Juan', doubled)
  assert.equal(juan.status, 'ambiguous')

  assert.equal(decideLink('Caride', USERS).status, 'unmatched')
})

test('un email ya puesto no se pisa', () => {
  const plan = planLinks(
    [
      { id: 1, label: 'Clari', userEmail: null },
      { id: 2, label: 'Clari', userEmail: 'otra@gmail.com' },
    ],
    USERS,
  )
  assert.equal(plan.link.length, 1)
  assert.equal(plan.link[0].id, 1)
  assert.equal(plan.already.length, 1)
})

test('Clara no ve Asado Timón; el admin sí; ver como Clara no es admin', () => {
  const asado = {
    email: 'clara.caride@holycross.edu.ar',
    role: 'member',
    ownerEmail: 'tomascaride@gmail.com',
    memberEmails: ['tomascaride@gmail.com', 'florencia.pastorini@gmail.com'],
  }
  assert.equal(canSeeResource(asado), false)
  assert.equal(canSeeResource({ ...asado, role: 'admin' }), true)
  assert.equal(canSeeResource({ ...asado, memberEmails: [...asado.memberEmails, asado.email] }), true)
  assert.equal(canManageResource(asado), false)
  assert.equal(canManageResource({ ...asado, role: 'admin' }), true)
  assert.equal(
    canManageResource({ email: 'tomascaride@gmail.com', role: 'member', ownerEmail: 'TomasCaride@gmail.com' }),
    true,
  )
})
