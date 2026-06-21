import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import './globals.css'
import { currentUser } from '@/lib/identity'

export const metadata: Metadata = {
  title: 'Olivia · Historia clínica',
  description: 'Historia clínica del embarazo: estudios, turnos, mediciones y notas',
  // Favicon de Casa Caride (servido por el shell en el apex). NORMA: todas las
  // apps usan estos paths absolutos para mantener el ícono unificado.
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
  if (!(await currentUser())) redirect('https://casa-caride.vercel.app/olivia')
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
