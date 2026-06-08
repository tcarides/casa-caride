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
  /** Color de fondo del tile (gradiente CSS). */
  gradient: string
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
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    kind: 'zone',
  },
  {
    slug: 'casas',
    name: 'Compra de casas',
    description: 'Propiedades, mapa y favoritos',
    href: '/casas',
    emoji: '🏠',
    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    kind: 'zone',
  },
  {
    slug: 'olivia',
    name: 'Olivia',
    description: 'Guía diaria de paternidad',
    href: '/olivia',
    emoji: '👶',
    gradient: 'linear-gradient(135deg, #f472b6, #ec4899)',
    kind: 'static',
  },
  {
    slug: 'fixture',
    name: 'Fixture Mundial',
    description: 'Argentina, calendario y grupos 2026',
    href: '/fixture',
    emoji: '⚽',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    kind: 'static',
  },
]
