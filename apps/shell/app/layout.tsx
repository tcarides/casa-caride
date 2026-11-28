import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { BootDismiss, BootScreen } from '@casa/boot'
import './globals.css'
import { SWRegister } from './sw-register'
import { ViewAsBanner } from './ViewAsBanner'

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
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
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
    <html lang="es" suppressHydrationWarning>
      <body>
        <BootScreen />
        {/* Tokens del design system, compartidos por todas las mini-apps */}
        <link rel="stylesheet" href="/ds/styles.css" />
        <Suspense fallback={null}>
          <ViewAsBanner />
        </Suspense>
        {children}
        <BootDismiss />
        <script src="/view-as.js" defer />
        <SWRegister />
      </body>
    </html>
  )
}
