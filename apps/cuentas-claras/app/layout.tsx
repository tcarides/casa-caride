import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import './globals.css'
import { currentUser } from '@/lib/identity'

export const metadata: Metadata = {
  title: 'Cuentas Claras',
  description: 'Dividí asados y eventos sin vueltas: quién puso qué y quién le debe a quién.',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Gate confiable (Node): sin sesión → al shell (que reenvía la cookie o pide login).
  if (!(await currentUser())) redirect('https://casa-caride.vercel.app/cuentas-claras')
  return (
    <html lang="es">
      <body>
        {/* Tokens del design system, servidos por el shell */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        {/* Back button / header estándar de Casa Caride */}
        <script src="/casa-nav.js" async />
      </body>
    </html>
  )
}
