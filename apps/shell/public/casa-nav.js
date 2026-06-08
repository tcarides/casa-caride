/*
 * casa-nav.js — Navegación compartida de Casa Caride.
 *
 * Lo sirve el shell en /casa-nav.js y lo incluyen TODAS las mini-apps con:
 *   <script src="/casa-nav.js" defer></script>
 * Así la navegación se itera tocando un solo archivo (no cada app).
 *
 * Patrón: botón flotante chico que se auto-oculta al scrollear hacia abajo y
 * reaparece al subir. Al tocarlo abre una "hoja" para saltar a cualquier app
 * o volver a Casa. Resalta la app actual.
 */
(function () {
  if (window.__casaNav) return;
  window.__casaNav = true;

  var APPS = [
    { name: 'Casa', emoji: '🏡', href: '/', home: true },
    { name: 'Súper', emoji: '🛒', href: '/super' },
    { name: 'Casas', emoji: '🏠', href: '/casas' },
    { name: 'Olivia', emoji: '👶', href: '/olivia' },
    { name: 'Fixture', emoji: '⚽', href: '/fixture' },
  ];

  var path = location.pathname;
  var current = APPS.filter(function (a) {
    return !a.home && path.indexOf(a.href) === 0;
  })[0];

  var CSS = [
    '.casa-fab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483000;',
    'width:46px;height:46px;border:0;border-radius:50%;background:rgba(15,23,42,.82);color:#fff;',
    'font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;',
    'box-shadow:0 8px 22px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
    'transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s;padding:0}',
    '.casa-fab:active{transform:scale(.9)}',
    '.casa-fab.casa-hidden{transform:translateY(120px) scale(.7);opacity:0;pointer-events:none}',
    // En apps con barra de navegación inferior propia (fixture), subir el botón.
    '.casa-fab.casa-raised{bottom:calc(80px + env(safe-area-inset-bottom))}',
    '.casa-ovl{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.45);opacity:0;',
    'pointer-events:none;transition:opacity .2s}',
    '.casa-ovl.casa-open{opacity:1;pointer-events:auto}',
    '.casa-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483002;',
    'background:#0f172a;color:#f1f5f9;border-radius:22px 22px 0 0;',
    'padding:10px 16px calc(20px + env(safe-area-inset-bottom));',
    'box-shadow:0 -10px 40px rgba(0,0,0,.5);transform:translateY(110%);',
    'transition:transform .28s cubic-bezier(.2,.8,.2,1);',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.casa-sheet.casa-open{transform:translateY(0)}',
    '.casa-grab{width:40px;height:4px;border-radius:99px;background:#334155;margin:6px auto 14px}',
    '.casa-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}',
    '@media (max-width:380px){.casa-grid{grid-template-columns:repeat(3,1fr)}}',
    '.casa-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;',
    'border-radius:16px;text-decoration:none;color:#cbd5e1;background:#1e293b;transition:background .15s}',
    '.casa-item:active{background:#334155}',
    '.casa-item.casa-cur{outline:2px solid #38bdf8;color:#fff}',
    '.casa-item .casa-em{font-size:26px;line-height:1}',
    '.casa-item .casa-lb{font-size:11.5px;font-weight:600}',
    '.casa-title{font-size:13px;color:#94a3b8;margin:0 2px 10px;font-weight:600}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // --- Botón flotante ---
  var fab = document.createElement('button');
  fab.className = 'casa-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Cambiar de app o volver a Casa');
  fab.textContent = current ? current.emoji : '🏡';
  // El fixture tiene su propia barra inferior: subimos el botón para no taparla.
  if (path.indexOf('/fixture') === 0) fab.classList.add('casa-raised');
  document.body.appendChild(fab);

  // --- Hoja (sheet) ---
  var ovl = document.createElement('div');
  ovl.className = 'casa-ovl';
  var sheet = document.createElement('div');
  sheet.className = 'casa-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Apps de Casa Caride');

  var html = '<div class="casa-grab"></div><p class="casa-title">Ir a…</p><div class="casa-grid">';
  for (var i = 0; i < APPS.length; i++) {
    var a = APPS[i];
    var cur = current && a.href === current.href ? ' casa-cur' : '';
    html += '<a class="casa-item' + cur + '" href="' + a.href + '">' +
      '<span class="casa-em">' + a.emoji + '</span>' +
      '<span class="casa-lb">' + a.name + '</span></a>';
  }
  html += '</div>';
  sheet.innerHTML = html;
  document.body.appendChild(ovl);
  document.body.appendChild(sheet);

  function open() { ovl.classList.add('casa-open'); sheet.classList.add('casa-open'); }
  function close() { ovl.classList.remove('casa-open'); sheet.classList.remove('casa-open'); }

  fab.addEventListener('click', open);
  ovl.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  // --- Auto-ocultar al scrollear hacia abajo ---
  var lastY = 0, ticking = false;
  function readPos(e) {
    var t = e && e.target;
    if (t && t !== document && t.scrollTop != null && t.scrollTop > 0) return t.scrollTop;
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  function onScroll(e) {
    var y = readPos(e);
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      if (y > lastY + 6 && y > 90) fab.classList.add('casa-hidden');
      else if (y < lastY - 6 || y < 90) fab.classList.remove('casa-hidden');
      lastY = y;
      ticking = false;
    });
  }
  // capture:true para detectar también scrolls de contenedores internos
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
})();
