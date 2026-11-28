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
  /**
   * Ilustración custom (ruta en public/, ej. '/apps/fabian.png'). Si está,
   * el tile se dibuja full-bleed con la imagen y el nombre en negro sobre el
   * fondo. Si no, cae al badge con emoji. Migración app por app.
   */
  icon?: string
  /** Color de fondo del tile cuando hay `icon` (debe coincidir con el fondo
   *  de la ilustración). Default amarillo Casa Caride. */
  iconBg?: string
  /** Color de identidad de la app (token del design system). */
  hue: string
  /** 'zone' = app Next vía rewrite · 'static' = HTML estático en public/ */
  kind: 'zone' | 'static'
  /**
   * Nivel de acceso (default 'permission'):
   *  - 'public'     → se usa sin login (se ve y funciona deslogueado).
   *  - 'open'       → default de todo usuario. Se ve en el launcher (incluso
   *                   deslogueado), pero al hacer click pide login; logueado
   *                   la usa cualquiera, sin fila en app_access. Un usuario
   *                   nuevo además recibe la fila prendida para que /admin
   *                   la muestre habilitada. No se puede revocar por usuario:
   *                   el gate no mira la fila, así nadie que ya entra la pierde.
   *  - 'permission' → login + permiso del admin. Sin permiso se ve en el
   *                   launcher, en la sección "Bloqueadas", y la URL redirige
   *                   a /?denied= (no se abre). Deslogueado no se muestra.
   */
  access?: 'public' | 'open' | 'permission'
}

export type AccessLevel = NonNullable<MiniApp['access']>

export function accessOf(app: MiniApp): AccessLevel {
  return app.access ?? 'permission'
}

export const APPS: MiniApp[] = [
  {
    slug: 'super',
    name: 'Lista del súper',
    description: 'Tu lista de compras, para compartir con quien quieras',
    href: '/super',
    emoji: '🛒',
    icon: '/apps/super.png',
    iconBg: '#34C77B',
    hue: 'var(--app-super)',
    kind: 'zone',
    access: 'open',
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
    description: 'Historia clínica',
    href: '/olivia',
    emoji: '👶',
    icon: '/apps/olivia.png',
    iconBg: '#FF8FB1',
    hue: 'var(--app-olivia)',
    kind: 'zone',
  },
  {
    slug: 'fabian',
    name: 'Fabián',
    description: 'La medicación del perro, cada 12 h',
    href: '/fabian',
    emoji: '🐶',
    icon: '/apps/fabian.png',
    iconBg: '#f7c901',
    hue: 'var(--app-fabian)',
    kind: 'zone',
  },
  {
    slug: 'cuentas-claras',
    name: 'Cuentas Claras',
    description: 'Dividí asados y eventos sin vueltas',
    href: '/cuentas-claras',
    emoji: '🧾',
    icon: '/apps/cuentas.png',
    iconBg: '#2DD4BF',
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
  {
    slug: 'navidad',
    name: 'Regalos de Navidad',
    description: 'Las listas de regalos de la familia',
    href: '/navidad',
    emoji: '🎄',
    icon: '/apps/navidad.png',
    iconBg: '#E0484D',
    hue: '#E0484D',
    kind: 'zone',
    access: 'open',
  },
]

/** Apps que cualquier usuario logueado puede abrir (access: 'open'). */
export function defaultMemberApps(): string[] {
  return APPS.filter((a) => accessOf(a) === 'open').map((a) => a.slug)
}

/**
 * Apps EXTERNAS (otro dominio, otro login): en el launcher son sólo un link,
 * visible únicamente para el admin. No pasan por rewrites, ni por el gate de
 * permisos, ni por /admin: el acceso lo controla la propia app (allowlist).
 * Por eso viven fuera de APPS (APPS alimenta el seed de permisos y /admin).
 */
export type ExternalLink = Pick<MiniApp, 'slug' | 'name' | 'description' | 'href' | 'emoji' | 'hue'>

export const ADMIN_LINKS: ExternalLink[] = [
  {
    slug: 'ingresos-egresos',
    name: 'Ingresos y Egresos',
    description: 'Mis finanzas: evolución y forecast',
    href: 'https://ingresos-egresos-green.vercel.app',
    emoji: '📈',
    hue: 'var(--app-finanzas)',
  },
]
