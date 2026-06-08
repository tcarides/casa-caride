import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SWRegister } from './sw-register'

export const metadata: Metadata = {
  title: 'Casa Caride',
  description: 'Las apps de la familia Caride en un solo lugar.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Casa Caride',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  )
}
