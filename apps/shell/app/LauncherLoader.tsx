/**
 * Pantalla de carga del launcher. Misma pieza que el splash del sistema
 * (icon-512 recortado en círculo, fondo #0a0a0a, glow del DS) para que el
 * pase del splash de la PWA no se note. El humo es sólo CSS.
 */
export function LauncherLoader() {
  return (
    <main className="loader" role="status" aria-label="Cargando Casa Caride">
      <div className="loader__disc">
        <img
          className="loader__house"
          src="/icon-512.png"
          alt=""
          width={192}
          height={192}
        />
        <div className="loader__smoke" aria-hidden="true">
          <span className="loader__puff loader__puff--1" />
          <span className="loader__puff loader__puff--2" />
          <span className="loader__puff loader__puff--3" />
        </div>
      </div>
    </main>
  )
}
