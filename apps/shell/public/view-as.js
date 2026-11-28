/*
 * view-as.js — barra "Viendo como … · Salir" en todas las mini-apps.
 * La sirve el shell. La identidad real la confirma GET /api/view-as;
 * la cookie cc_viewing solo evita el parpadeo. Salir es un POST al shell.
 */
(function () {
  if (window.__ccViewAs) return;
  window.__ccViewAs = true;

  function readCookie(name) {
    var parts = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      var key = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      if (key === name) {
        try { return decodeURIComponent(parts[i].slice(eq + 1)); }
        catch (e) { return parts[i].slice(eq + 1); }
      }
    }
    return '';
  }

  function renderBanner(name) {
    if (document.querySelector('.cc-viewas')) return;
    var bar = document.createElement('div');
    bar.className = 'cc-viewas';
    bar.setAttribute('role', 'status');
    bar.setAttribute('data-source', 'script');

    var text = document.createElement('p');
    text.className = 'cc-viewas__text';
    text.appendChild(document.createTextNode('Viendo como '));
    var strong = document.createElement('strong');
    strong.textContent = name;
    text.appendChild(strong);
    var sep = document.createElement('span');
    sep.className = 'cc-viewas__sep';
    sep.textContent = ' · solo lectura';
    text.appendChild(sep);

    var form = document.createElement('form');
    form.method = 'post';
    form.action = '/api/view-as/stop';
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'cc-viewas__exit';
    btn.textContent = 'Salir';
    form.appendChild(btn);

    bar.appendChild(text);
    bar.appendChild(form);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function showToast(message) {
    var el = document.querySelector('.cc-viewas-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cc-viewas-toast';
      el.setAttribute('role', 'alert');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { el.classList.remove('is-on'); }, 4500);
  }

  var hooked = false;
  function installHook() {
    if (hooked || !window.fetch) return;
    hooked = true;
    var orig = window.fetch;
    window.fetch = function () {
      return Promise.resolve(orig.apply(this, arguments)).then(function (res) {
        if (res && res.status === 403) {
          res.clone().json().then(function (body) {
            if (body && body.code === 'view_as_readonly' && body.error) showToast(body.error);
          }).catch(function () {});
        }
        return res;
      });
    };
  }

  var hint = readCookie('cc_viewing');
  if (hint) {
    installHook();
    if (document.body) renderBanner(hint);
    else document.addEventListener('DOMContentLoaded', function () { renderBanner(hint); });
  }

  fetch('/api/view-as', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      if (!data.viewing || !data.viewing.name) {
        document.querySelectorAll('.cc-viewas').forEach(function (el) { el.remove(); });
        return;
      }
      installHook();
      renderBanner(data.viewing.name);
    })
    .catch(function () {});
})();
