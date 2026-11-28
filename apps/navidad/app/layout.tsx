import type { Metadata, Viewport } from 'next'
import './globals.css'

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

// Layout raíz: sólo el esqueleto HTML + estilos. El gate de sesión vive en
// (app)/layout.tsx para que la vista pública /ver/[token] quede libre.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* Tokens del design system, servidos por el shell */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        <script src="/view-as.js" defer />
      </body>
    </html>
  )
}
