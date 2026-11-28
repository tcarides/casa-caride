/**
 * La misma flecha que inyecta /casa-nav.js (clase, svg y aria-label).
 * Va en el árbol de React para que el script la vea y no inserte otra:
 * insertarla después del SSR rompía la hidratación del header.
 */
export function CasaBack({ href }: { href: string }) {
  return (
    <a className="casa-back" href={href} aria-label="Volver">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </a>
  )
}
