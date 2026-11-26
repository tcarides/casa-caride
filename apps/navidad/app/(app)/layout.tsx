import { redirect } from 'next/navigation'
import { hasSession } from '@/lib/session'

// Gate de sesión para la app (grupos, personas, edición). Sin cookie → al shell
// (que reenvía la cookie o pide login). La vista pública /ver/[token] NO pasa
// por acá, así que se puede abrir sin login.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasSession())) redirect('https://casa-caride.vercel.app/navidad')
  return <>{children}</>
}
