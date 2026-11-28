import { getViewer } from '@/lib/view-as'

/** Barra fija mientras un admin mira la casa como otra persona. */
export async function ViewAsBanner() {
  const { viewing } = await getViewer()
  if (!viewing) return null
  return (
    <div className="cc-viewas" role="status">
      <p className="cc-viewas__text">
        Viendo como <strong>{viewing.name}</strong>
        <span className="cc-viewas__sep"> · solo lectura</span>
      </p>
      <form action="/api/view-as/stop" method="post">
        <button type="submit" className="cc-viewas__exit">Salir</button>
      </form>
    </div>
  )
}
