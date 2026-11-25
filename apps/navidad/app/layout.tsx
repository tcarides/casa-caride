import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import './globals.css'
import { hasSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Regalos de Navidad',
  description: 'Las listas de regalos de la familia: qué quiere cada uno para Navidad.',
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Gate: sin cookie de sesión → al shell (que reenvía la cookie o pide login).
  if (!(await hasSession())) redirect('https://casa-caride.vercel.app/navidad')
  return (
    <html lang="es">
      <body>
        {/* Tokens del design system, servidos por el shell */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        {/* Navidad maneja su propia navegación por niveles (grupo → persona)
            con back etiquetado, así que NO usa la flecha global de casa-nav.js
            (que navega por segmentos de URL y no entiende los niveles ?g=&p=). */}
      </body>
    </html>
  )
}
