import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Casas — Zona Norte',
  description: 'Buscador personal de propiedades en San Isidro y San Fernando',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        {children}
        {/* Volver al launcher de Casa Caride (origen raíz, fuera del basePath). */}
        <a
          href="/"
          aria-label="Volver a Casa Caride"
          style={{
            position: 'fixed',
            left: '12px',
            top: 'calc(12px + env(safe-area-inset-top))',
            zIndex: 99999,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(15,23,42,.85)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            textDecoration: 'none',
            boxShadow: '0 6px 18px rgba(0,0,0,.35)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          🏡
        </a>
        <Toaster
          position="bottom-center"
          theme="dark"
          toastOptions={{
            style: {
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
            },
          }}
        />
      </body>
    </html>
  )
}
