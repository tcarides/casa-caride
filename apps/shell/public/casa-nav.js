/*
 * casa-nav.js — Navegación compartida de Casa Caride.
 *
 * Lo sirve el shell en /casa-nav.js y lo incluyen TODAS las mini-apps con:
 *   <script src="/casa-nav.js" defer></script>
 * Toda la navegación se itera tocando SOLO este archivo.
 *
 * Patrón: inyecta la clásica flecha "atrás" como primer elemento del <header>
 * de cada app (alineada con su logo, heredando el color del header con
 * currentColor para verse nativa). Es el ÚNICO botón de "volver": sube un
 * nivel — una subpágina (L3) vuelve a la home de su zona (L2) y la home de una
 * zona (L2) vuelve al launcher (L1).
 */
(function () {
  if (window.__casaNav) return;
  window.__casaNav = true;

  // A dónde sube la flecha desde la URL actual:
  //  - subpágina (2+ segmentos, ej. /casas/oportunidades) → home de la zona (/casas).
  //  - home de zona (1 segmento, ej. /casas) o launcher → Casa (/).
  function backHref() {
    var segs = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return segs.length > 1 ? '/' + segs[0] : '/';
  }

  var ARROW =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 18l-6-6 6-6"/></svg>';

  var FONT =
    'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

  var CSS = [
    // Flecha "atrás": idéntica en todas las apps, hereda el color del header.
    '.casa-back{display:inline-flex;align-items:center;justify-content:center;',
    'width:34px;height:34px;flex:0 0 auto;border-radius:10px;',
    'color:inherit;text-decoration:none;opacity:.8;cursor:pointer;',
    '-webkit-tap-highlight-color:transparent;',
    'transition:background .15s,opacity .15s,transform .1s}',
    '.casa-back:hover{opacity:1;background:rgba(127,127,127,.18)}',
    '.casa-back:active{transform:scale(.88)}',
    // Fila del título: agrupa la flecha + el bloque de título a la izquierda.
    '.casa-headrow{display:flex;align-items:center;gap:8px;min-width:0}',
    // Bloque de título unificado: misma tipografía en todas las apps.
    // Usa color:inherit para adaptarse al color de fondo de cada header.
    '.casa-title{display:flex;flex-direction:column;gap:1px;min-width:0;font-family:var(--font-display,' + FONT + ')}',
    '.casa-title h1,.casa-title .casa-title__name{margin:0;font-size:1.25rem;',
    'font-weight:var(--fw-medium,600);letter-spacing:-.01em;line-height:1.2;color:inherit;font-family:inherit}',
    '.casa-title p,.casa-title .casa-title__sub{margin:0;font-size:.8rem;font-weight:400;',
    'line-height:1.25;color:inherit;opacity:.7;font-family:inherit}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  function makeArrow() {
    var a = document.createElement('a');
    a.className = 'casa-back';
    a.href = backHref();
    a.setAttribute('aria-label', 'Volver');
    a.innerHTML = ARROW;
    // Recalcula el destino al tocar (la URL pudo cambiar por navegación cliente).
    a.addEventListener('click', function (e) {
      e.preventDefault();
      location.href = backHref();
    });
    return a;
  }

  function inject() {
    var header = document.querySelector('header');
    if (!header) return;
    if (header.querySelector('.casa-back')) return; // ya inyectada
    // Si la app define una fila de título (.casa-headrow), la flecha va ahí,
    // alineada con el título. Si no, como primer elemento del header.
    var target = header.querySelector('.casa-headrow') || header;
    target.insertBefore(makeArrow(), target.firstChild);
  }

  // Inicial + cuando el DOM termina de cargar.
  inject();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  }

  // Re-inyectar tras renders/navegación cliente (Next reemplaza el <header>).
  // Debounce con rAF para no trabajar de más en apps con mucho movimiento.
  var pending = false;
  var obs = new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      inject();
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
