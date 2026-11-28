import { Suspense } from 'react'
import { Launcher } from './launcher'
import { LauncherLoader } from './LauncherLoader'

// El page es síncrono para que el fallback (el loader) salga en el primer HTML,
// mientras el launcher resuelve sesión y permisos. Sin JS de por medio.
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  return (
    <Suspense fallback={<LauncherLoader />}>
      <Launcher searchParams={searchParams} />
    </Suspense>
  )
}
