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
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        {/* Navegación compartida de Casa Caride (módulo servido por el shell). */}
        <script src="/casa-nav.js" async />
      </body>
    </html>
  );
}
