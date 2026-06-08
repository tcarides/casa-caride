# Cómo actualizar la base de casas

Guía paso a paso para correr el scraper y dejar la base completa.
Fuentes: **ZonaProp**, **ArgenProp** y **MercadoLibre** (San Isidro + San Fernando, casas + PH).

---

## TL;DR (lo que vas a correr casi siempre)

```bash
cd scraper
npm run scrape:full      # barrido COMPLETO de las 3 fuentes (~15-20 min)
```

- Si MercadoLibre se saltea pidiendo cookies → seguí **"Cookies de MercadoLibre"** (abajo) y volvé a correr.
- ZonaProp y ArgenProp **no** necesitan cookies.
- Al terminar, commiteá `webapp/data/properties.json` (y pusheá si querés que Vercel redespliegue).

---

## ¿`scrape` o `scrape:full`?

| Comando | Qué hace | Cuándo |
|---|---|---|
| `npm run scrape` | Incremental: corta cuando una página ya es toda conocida. Rápido. | Chequeos rápidos de "¿hay algo nuevo arriba?" |
| `npm run scrape:full` | **Barrido completo**: recorre todo, sin cortar. Más lento. | **Actualización de verdad** / garantizar cobertura total |

> Recomendado: usar **`scrape:full`** para actualizar bien. El modo incremental
> puede perderse propiedades nuevas que queden enterradas en el medio del listado
> (los sitios ordenan por relevancia, no por fecha).

Por fuente:
```bash
npm run scrape:ml:full   # solo MercadoLibre, completo
npm run scrape:ap:full   # solo ArgenProp, completo
npm run scrape:zp        # solo ZonaProp (no tiene tope, no necesita :full)
```

---

## Cookies de MercadoLibre (se renuevan cada ~días)

MercadoLibre exige sesión logueada. Las cookies viven en `scraper/.ml-cookies.txt`
(gitignored). **Expiran**, así que cada tanto hay que refrescarlas.

**Cómo sabés que hay que refrescarlas:** al correr, el scraper te avisa con un cartel
grande que dice que ML necesita cookies y te lista estos mismos pasos. Si ves eso,
ZonaProp y ArgenProp igual se actualizan; solo ML queda salteado hasta refrescar.

**Cómo obtenerlas (2 min):**
1. Abrí Chrome **ya logueado** en `mercadolibre.com.ar`.
2. Entrá a: https://inmuebles.mercadolibre.com.ar/casas/venta/bsas-gba-norte/san-isidro/
   → confirmá que **ves los listados** (no una pantalla de "verificación de cuenta").
3. `F12` (DevTools) → pestaña **Network** → recargá con `F5`.
4. Click en la **1ª request** de la lista (el documento, `san-isidro/`).
5. **Headers** → sección **Request Headers** → buscá la línea **`Cookie:`**.
6. Copiá **todo** el valor (es largo).
   - ⚠️ NO uses `document.cookie` en la consola: ese no trae las cookies de login (HttpOnly).
7. Pegalo en **una sola línea** en `scraper/.ml-cookies.txt` y guardá.
8. Volvé a correr el scrape.

---

## Después de scrapear → subir a PRODUCCIÓN

La "base" en prod son dos cosas:
- **Listados** (las casas) → viven en `webapp/data/properties.json`, se deployan con la app → **se actualizan con `git push`** (Vercel redeploya solo).
- **Grupos de duplicados** → viven en el Postgres de prod → el `dedupe` los escribe **directo ahí** (no necesita deploy).
- **Estados/notas/favoritos** → Postgres de prod, los escribe la app en vivo.

```bash
cd scraper
npm run cleanup          # (opcional) marca avisos caídos (404/410)
npm run dedupe           # agrupa duplicados → escribe los grupos DIRECTO al Postgres de prod + calcula phash

cd ..
git add webapp/data/properties.json
git commit -m "Datos: actualiza properties.json"
git push                 # ← esto actualiza los listados en PROD (Vercel redeploya automáticamente)
```

Listo: el `push` lleva los listados a prod; el `dedupe` ya dejó los grupos en el Postgres de prod.

> **El scrape es LOCAL sí o sí.** Desde la nube (Vercel/GitHub Actions) los sitios devuelven 403
> (bloquean IPs de datacenter). Por eso: scrapear local → push.
> `.ml-cookies.txt` está gitignored — nunca se commitea (son tus credenciales).
> El `dedupe` usa el `DATABASE_URL` de `webapp/.env.local` para escribir en el Postgres de prod.

---

## Detalles técnicos (por si algo falla)

- **ZonaProp**: paginación por path `-pagina-N.html`. Sin tope problemático.
- **ArgenProp**: URLs `partido-de-*`. Tope de paginación ~página 100 (1980 avisos);
  casas San Isidro (~2724) se parte por **rango de precio USD** automáticamente.
- **MercadoLibre**: URLs con región `bsas-gba-norte` + `?skipInApp=true&matt_ignore=true`.
  - Resuelve un challenge proof-of-work (`_bmstate` → `_bmc`) automáticamente.
  - Tope de paginación ~item 765 por búsqueda → se cubre con **split por precio** y
    **scrape por barrio** (que además etiqueta el barrio real de cada propiedad).
- El JSON se escribe en `webapp/data/properties.json`. La escritura es atómica con
  reintento (en Windows el antivirus a veces lockea el archivo).
- **No corras dos scrapes a la vez**: los dos escriben el mismo JSON y se pisan.
