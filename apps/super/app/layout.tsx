import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/identity'

export const metadata: Metadata = {
  title: 'Lista del súper',
  description: 'Lista del supermercado compartida de Flor y Tomás',
  applicationName: 'Lista súper',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lista súper',
  },
  icons: {
    icon: '/super/icon-192.png',
    apple: '/super/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  if (!(await currentUser())) redirect('https://casa-caride.vercel.app/super')
  return (
    <html lang="es">
      <body>
        {/* Tokens del design system, servidos por el shell. */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        {/* Navegación compartida de Casa Caride (módulo servido por el shell). */}
        <script src="/casa-nav.js" async />
      </body>
    </html>
  )
}
