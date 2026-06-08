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
        {/* Volver al launcher de Casa Caride (origen raíz, fuera del basePath). */}
        <a
          href="/"
          aria-label="Volver a Casa Caride"
          style={{
            position: "fixed",
            left: "12px",
            top: "calc(12px + env(safe-area-inset-top))",
            zIndex: 99999,
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            background: "rgba(15,23,42,.85)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            textDecoration: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,.35)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          🏡
        </a>
      </body>
    </html>
  );
}
