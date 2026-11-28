import { Suspense } from 'react'
import { Launcher } from './launcher'

// El loader visible es BootScreen, en el layout. Un fallback de Suspense lo
// saca React antes del primer paint, y el splash de Android levanta sobre la
// página ya armada.
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; 'solo-lectura'?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <Launcher searchParams={searchParams} />
    </Suspense>
  )
}
