import "./globals.css";

export const metadata = {
  title: "Lista del súper",
  description: "Lista del supermercado compartida de Flor y Tomás",
  applicationName: "Lista súper",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lista súper",
  },
  icons: {
    icon: "/super/icon-192.png",
    apple: "/super/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {/* Tokens del design system, servidos por el shell. */}
        <link rel="stylesheet" href="/ds/styles.css" />
        {children}
        {/* Navegación compartida de Casa Caride (módulo servido por el shell). */}
        <script src="/casa-nav.js" async />
      </body>
    </html>
  );
}
