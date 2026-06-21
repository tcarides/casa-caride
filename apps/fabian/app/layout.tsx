import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import './globals.css'
import { currentUser } from '@/lib/identity'

export const metadata: Metadata = {
  title: 'Fabián · Medicación',
  description: 'Registro de medicación de Fabián — cada 12 h',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentUser())) redirect('https://casa-caride.vercel.app/fabian')
  return (
    <html lang="es">
      <body>
        {/* DS tokens compartidos, servidos por el shell */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        {/* Back button y header estándar de Casa Caride */}
        <script src="/casa-nav.js" async />
      </body>
    </html>
  )
}
