/**
 * Pantalla de arranque de Casa Caride.
 *
 * El splash de Android (ícono del manifest sobre #0a0a0a) se va en el primer
 * paint. El fallback de Suspense no sirve para eso: el server manda el loader
 * y la página ya armada en el mismo HTML, y el script de React saca el loader
 * mientras el browser todavía está parseando, antes de pintar. El splash
 * levanta directo sobre la página y el humo no llega a verse.
 *
 * Esta capa vive fuera de ese swap. El CSS va inline para poder pintar sin
 * esperar el bundle. Se apaga después del primer frame: si la página ya venía
 * en el HTML, se sostiene lo justo para que el handoff se vea; si todavía
 * está cargando, se va en cuanto aparece.
 */

const CSS = `
html:not(.cc-booted), html:not(.cc-booted) body { background: #0a0a0a; }
#cc-boot {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  background: #0a0a0a;
  pointer-events: none;
}
html.cc-booted #cc-boot { display: none; }
.cc-boot__disc { position: relative; width: 192px; height: 192px; }
.cc-boot__house {
  width: 192px;
  height: 192px;
  display: block;
  border-radius: 50%;
  object-fit: cover;
  background: #f7c901;
  box-shadow: 0 4px 18px -4px rgba(255, 214, 0, 0.35);
}
.cc-boot__smoke {
  position: absolute;
  left: 67.87%;
  top: 25%;
  width: 0;
  height: 0;
  z-index: 2;
}
.cc-boot__puff {
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  margin-top: -8px;
  border-radius: 50%;
  background: radial-gradient(circle at 42% 40%, rgba(248,248,246,0.95) 0%, rgba(220,220,216,0.55) 38%, rgba(170,170,166,0.18) 66%, rgba(170,170,166,0) 78%);
  filter: blur(3px);
  opacity: 0;
  will-change: transform, opacity;
  animation: cc-smoke 2.8s ease-out infinite;
}
.cc-boot__puff--1 { width: 17px; height: 17px; margin-left: -8.5px; animation-duration: 2.75s; animation-delay: 0s; }
.cc-boot__puff--2 { width: 21px; height: 21px; margin-left: -10.5px; filter: blur(3.5px); animation-duration: 3s; animation-delay: 0.95s; animation-name: cc-smoke-b; }
.cc-boot__puff--3 { width: 15px; height: 15px; margin-left: -7.5px; filter: blur(3.2px); animation-duration: 2.6s; animation-delay: 1.85s; animation-name: cc-smoke-c; }
@keyframes cc-smoke {
  0% { opacity: 0; transform: translate(0, 5px) scale(0.28); }
  8% { opacity: 0.85; transform: translate(0.5px, -2px) scale(0.55); }
  28% { opacity: 0.62; transform: translate(-5px, -28px) scale(1.05); }
  58% { opacity: 0.28; transform: translate(7px, -62px) scale(1.65); }
  100% { opacity: 0; transform: translate(-3px, -108px) scale(2.2); }
}
@keyframes cc-smoke-b {
  0% { opacity: 0; transform: translate(0, 6px) scale(0.28); }
  12% { opacity: 0.8; transform: translate(-2px, -6px) scale(0.7); }
  40% { opacity: 0.55; transform: translate(6px, -38px) scale(1.25); }
  70% { opacity: 0.22; transform: translate(-8px, -72px) scale(1.85); }
  100% { opacity: 0; transform: translate(4px, -108px) scale(2.4); }
}
@keyframes cc-smoke-c {
  0% { opacity: 0; transform: translate(0, 5px) scale(0.32); }
  14% { opacity: 0.82; transform: translate(2px, -5px) scale(0.6); }
  38% { opacity: 0.55; transform: translate(8px, -30px) scale(1.1); }
  68% { opacity: 0.22; transform: translate(-2px, -66px) scale(1.65); }
  100% { opacity: 0; transform: translate(-6px, -94px) scale(2.15); }
}
@media (prefers-reduced-motion: reduce) {
  .cc-boot__puff { animation: none !important; opacity: 0; visibility: hidden; }
}
`.trim()

// Si la página ya venía en el mismo HTML, el splash se iría directo a ella.
// 600 ms alcanza para un soplo de humo y no es una espera larga. Si la página
// todavía no está, no se suma nada: se apaga cuando aparece.
const DISMISS = `
(function () {
  var MIN = 600;
  var CAP = 8000;
  function appReady() {
    var nodes = document.querySelectorAll('main, header');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.closest && n.closest('#cc-boot')) continue;
      if (n.closest && n.closest('[hidden]')) continue;
      return true;
    }
    return false;
  }
  var paintedAt = 0;
  var capAt = 0;
  var readyAtPaint = false;
  function hide() {
    document.documentElement.classList.add('cc-booted');
  }
  function tick() {
    if (performance.now() > capAt) { hide(); return; }
    if (appReady()) {
      if (!readyAtPaint || performance.now() - paintedAt >= MIN) hide();
      else setTimeout(tick, 40);
      return;
    }
    readyAtPaint = false;
    setTimeout(tick, 40);
  }
  // El script está antes del HTML de la página (Suspense lo manda después).
  // Recién en el primer frame se sabe si la página ya estaba o sigue en camino.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      paintedAt = performance.now();
      capAt = paintedAt + CAP;
      readyAtPaint = appReady();
      tick();
    });
  });
})();
`.trim()

export function BootScreen() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="cc-boot" role="status" aria-label="Cargando Casa Caride">
        <div className="cc-boot__disc">
          <img className="cc-boot__house" src="/icon-512.png" alt="" width={192} height={192} />
          <div className="cc-boot__smoke" aria-hidden="true">
            <span className="cc-boot__puff cc-boot__puff--1" />
            <span className="cc-boot__puff cc-boot__puff--2" />
            <span className="cc-boot__puff cc-boot__puff--3" />
          </div>
        </div>
      </div>
    </>
  )
}

/** Va al final del body, después de la página, para ver si ya está pintable. */
export function BootDismiss() {
  return <script dangerouslySetInnerHTML={{ __html: DISMISS }} />
}
