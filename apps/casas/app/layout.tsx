import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Casas — Zona Norte',
  description: 'Buscador personal de propiedades en San Isidro y San Fernando',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        {/* Tokens del design system, servidos por el shell. */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        {/* Navegación compartida de Casa Caride (módulo servido por el shell). */}
        <script src="/casa-nav.js" async />
        <Toaster
          position="bottom-center"
          theme="dark"
          toastOptions={{
            style: {
              background: '#141414',
              border: '1px solid #2a2a2a',
              color: '#f2f2f0',
            },
          }}
        />
      </body>
    </html>
  )
}
