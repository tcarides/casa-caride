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
    description: 'Guía diaria de paternidad',
    href: '/olivia',
    emoji: '👶',
    hue: 'var(--app-olivia)',
    kind: 'static',
  },
  {
    slug: 'fixture',
    name: 'Fixture Mundial',
    description: 'Argentina, calendario y grupos 2026',
    href: '/fixture',
    emoji: '⚽',
    hue: 'var(--app-fixture)',
    kind: 'static',
  },
]
