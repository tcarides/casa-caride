/**
 * Registro central de mini-apps. Agregar una nueva app a la "casa" es tan
 * simple como sumar una entrada acá (y, si es una app Next, una zona en
 * next.config.ts).
 */
export type MiniApp = {
  slug: string
  name: string
  description: string
  href: string
  emoji: string
  /** Color de identidad de la app (token del design system). */
  hue: string
  /** 'zone' = app Next vía rewrite · 'static' = HTML estático en public/ */
  kind: 'zone' | 'static'
  /**
   * Nivel de acceso (default 'permission'):
   *  - 'public'     → se usa sin login (se ve y funciona deslogueado).
   *  - 'open'       → se ve en el launcher (incluso deslogueado), pero al hacer
   *                   click pide login; logueado la usa cualquiera.
   *  - 'permission' → requiere login + permiso del admin (no se ve deslogueado).
   */
  access?: 'public' | 'open' | 'permission'
}

export const APPS: MiniApp[] = [
  {
    slug: 'super',
    name: 'Lista del súper',
    description: 'La compra compartida de Flor y Tomás',
    href: '/super',
    emoji: '🛒',
    hue: 'var(--app-super)',
    kind: 'zone',
  },
  {
    slug: 'casas',
    name: 'Compra de casas',
    description: 'Propiedades, mapa y favoritos',
    href: '/casas',
    emoji: '🏠',
    hue: 'var(--app-casas)',
    kind: 'zone',
  },
  {
    slug: 'olivia',
    name: 'Olivia',
    description: 'Historia clínica del embarazo',
    href: '/olivia',
    emoji: '👶',
    hue: 'var(--app-olivia)',
    kind: 'zone',
  },
  {
    slug: 'fixture',
    name: 'Fixture Mundial',
    description: 'Argentina, calendario y grupos 2026',
    href: '/fixture',
    emoji: '⚽',
    hue: 'var(--app-fixture)',
    kind: 'static',
    access: 'public',
  },
  {
    slug: 'fabian',
    name: 'Fabián',
    description: 'La medicación del perro, cada 12 h',
    href: '/fabian',
    emoji: '🐶',
    hue: 'var(--app-fabian)',
    kind: 'zone',
  },
  {
    slug: 'cuentas-claras',
    name: 'Cuentas Claras',
    description: 'Dividí asados y eventos sin vueltas',
    href: '/cuentas-claras',
    emoji: '🧾',
    hue: 'var(--app-cuentas)',
    kind: 'zone',
    access: 'open',
  },
  {
    slug: 'gastos',
    name: 'Gastos de Casa',
    description: 'Gastos del mes, quién paga y qué falta',
    href: '/gastos',
    emoji: '💸',
    hue: 'var(--app-gastos)',
    kind: 'zone',
  },
]
