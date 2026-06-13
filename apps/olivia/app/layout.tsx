import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Olivia · Historia clínica',
  description: 'Historia clínica del embarazo: estudios, turnos, mediciones y notas',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
