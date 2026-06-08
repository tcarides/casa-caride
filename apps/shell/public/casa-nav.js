/*
 * casa-nav.js — Navegación compartida de Casa Caride.
 *
 * Lo sirve el shell en /casa-nav.js y lo incluyen TODAS las mini-apps con:
 *   <script src="/casa-nav.js" defer></script>
 * Toda la navegación se itera tocando SOLO este archivo.
 *
 * Patrón: inyecta la clásica flecha "atrás" como primer elemento del <header>
 * de cada app (alineada con su logo, heredando el color del header con
 * currentColor para verse nativa). Al tocarla, vuelve a Casa (el launcher).
 */
(function () {
  if (window.__casaNav) return;
  window.__casaNav = true;

  // A dónde vuelve la flecha. '/' = launcher de Casa Caride.
  var HOME = '/';

  var ARROW =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 18l-6-6 6-6"/></svg>';

  var CSS = [
    '.casa-back{display:inline-flex;align-items:center;justify-content:center;',
    'width:34px;height:34px;flex:0 0 auto;margin-right:6px;border-radius:10px;',
    'color:inherit;text-decoration:none;opacity:.8;cursor:pointer;',
    '-webkit-tap-highlight-color:transparent;',
    'transition:background .15s,opacity .15s,transform .1s}',
    '.casa-back:hover{opacity:1;background:rgba(127,127,127,.18)}',
    '.casa-back:active{transform:scale(.88)}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  function makeArrow() {
    var a = document.createElement('a');
    a.className = 'casa-back';
    a.href = HOME;
    a.setAttribute('aria-label', 'Volver a Casa Caride');
    a.innerHTML = ARROW;
    return a;
  }

  function inject() {
    var header = document.querySelector('header');
    if (!header) return;
    // ya inyectada
    if (header.firstChild && header.firstChild.classList &&
        header.firstChild.classList.contains('casa-back')) return;
    if (header.querySelector('.casa-back')) return;
    header.insertBefore(makeArrow(), header.firstChild);
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
