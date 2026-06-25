# Cómo actualizar la base de casas

Guía paso a paso para correr el scraper y dejar la base completa.
Fuentes: **ZonaProp**, **ArgenProp** y **MercadoLibre** (San Isidro + San Fernando, casas + PH).

> ⚡ Atajo: en Claude Code corré **`/actualizar-casas`** y te guío por todo esto.

---

## Rutas (monorepo)

- Scraper: **`tools/casas-scraper/`** (corré los `npm run` desde acá).
- Base de listados (la que sirve la app): **`apps/casas/data/properties.json`**.
  El scraper lee/escribe ESE archivo y mergea contra lo existente (preserva
  `firstSeenAt`/historial). **No** hay un `webapp/data/` — eso era el layout viejo.
- Cookies de ML: **`tools/casas-scraper/.ml-cookies.txt`** (gitignored).
- Env para dedupe/cleanup: **`apps/casas/.env.local`** (gitignored, ver más abajo).

---

## TL;DR (lo que vas a correr casi siempre)

```bash
cd tools/casas-scraper
npm run scrape:full      # barrido COMPLETO de las 3 fuentes (~15-20 min)
```

- Si MercadoLibre se saltea pidiendo cookies → seguí **"Cookies de MercadoLibre"** (abajo) y volvé a correr.
- ZonaProp y ArgenProp **no** necesitan cookies.
- Al terminar, **validá la salida** (ver checklist) y commiteá `apps/casas/data/properties.json` + `git push` (Vercel redeploya).

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

MercadoLibre exige sesión logueada. Las cookies viven en `tools/casas-scraper/.ml-cookies.txt`
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
7. Pegalo en **una sola línea** en `tools/casas-scraper/.ml-cookies.txt` y guardá.
8. (Opcional) validá la sesión sin correr todo el scrape:
   ```bash
   npx tsx -e "import('./src/ml-fetch.ts').then(m=>m.preflightMl()).then(ok=>process.exit(ok?0:1))"
   ```
9. Volvé a correr el scrape.

---

## Validar la salida (IMPORTANTE — no saltear)

Antes de commitear, confirmá que el scrape **mergeó bien** y no arrancó de cero.
Una corrida sana mantiene el historial; una rota estampa TODO con la fecha de hoy
y pierde fuentes.

```bash
node -e '
const a=require("fs").readFileSync("../../apps/casas/data/properties.json","utf8");
const p=JSON.parse(a); const by={};
for(const x of p) by[x.source]=(by[x.source]||0)+1;
const fechas=p.map(x=>x.firstSeenAt).filter(Boolean).sort();
const hoy=new Date().toISOString().slice(0,10);
const todasHoy=p.length>0 && fechas.every(f=>f.slice(0,10)===hoy);
console.log("total:", p.length, "| por fuente:", JSON.stringify(by));
console.log("firstSeenAt:", fechas[0], "→", fechas[fechas.length-1]);
console.log(todasHoy ? "🔴 TODAS firstSeenAt = HOY → arrancó de base VACÍA, NO commitear" : "✓ historial preservado");
'
```

Checklist:
- **Total** ~13k+ (no debería desplomarse a ~8k).
- **3 fuentes** presentes: `zonaprop`, `argenprob`, `mercadolibre` (si ML = 0 → faltaron cookies).
- **`firstSeenAt`** con fechas viejas (feb/mar/…), NO todas de hoy.

Si algo de esto falla, **no commitees**: revisá cookies / que el scraper apunte a
`apps/casas/data/properties.json` y volvé a correr.

---

## Después de scrapear → subir a PRODUCCIÓN

La "base" en prod son dos cosas:
- **Listados** (las casas) → viven en `apps/casas/data/properties.json`, se deployan con la app → **se actualizan con `git push`** (Vercel redeploya solo).
- **Grupos de duplicados** → viven en el Postgres de prod → el `dedupe` los escribe **directo ahí** (no necesita deploy).
- **Estados/notas/favoritos** → Postgres de prod, los escribe la app en vivo.

**Env para dedupe/cleanup** (necesitan `DATABASE_URL`/`POSTGRES_URL` del Postgres de prod).

> ⚠️ **`vercel env pull` NO sirve para esto.** Las vars de Postgres son **"Sensitive"**
> (integración Neon) y se descargan **vacías** (`DATABASE_URL=""`). Hay que copiar el
> string real a mano:
> 1. Vercel → scope `tcarides-projects` → **Storage** → base **`casas-db`** →
>    pestaña **`.env.local`** → **"Show secret"** 👁️ → copiar el valor de **`POSTGRES_URL`**
>    (la *pooled*, host con `-pooler`).
> 2. Pegarlo en `apps/casas/.env.local` como `POSTGRES_URL` **y** `DATABASE_URL` (mismo valor).
>
> (Tip: probá la conexión con un `SELECT 1` vía `@vercel/postgres` antes de seguir.)

Luego:
```bash
npm run cleanup          # (opcional) marca avisos caídos (404/410). SOLO escribe a
                         # Postgres si ve DATABASE_URL al arrancar; sino quedan en el JSON.
npm run push-caidas      # subí a Postgres las caídas que cleanup dejó en el JSON
                         # (sin re-chequear URLs) — útil si corriste cleanup sin el string.
npm run dedupe           # agrupa duplicados → escribe los grupos DIRECTO al Postgres de prod + calcula phash

cd ../..
git add apps/casas/data/properties.json
git commit -m "Datos: actualiza properties.json"
git push                 # ← esto actualiza los listados en PROD (Vercel redeploya automáticamente)
```

Listo: el `push` lleva los listados a prod; el `dedupe` ya dejó los grupos en el Postgres de prod.

> **El scrape es LOCAL sí o sí.** Desde la nube (Vercel/GitHub Actions) los sitios devuelven 403
> (bloquean IPs de datacenter). Por eso: scrapear local → push.
> `.ml-cookies.txt` y `.env.local` están gitignored — nunca se commitean (son credenciales).
> El `dedupe` usa el `DATABASE_URL` de `apps/casas/.env.local` para escribir en el Postgres de prod.

---

## Detalles técnicos (por si algo falla)

- **ZonaProp**: paginación por path `-pagina-N.html`. Sin tope problemático.
- **ArgenProp**: URLs `partido-de-*`. Tope de paginación ~página 100 (1980 avisos);
  casas San Isidro (~2724) se parte por **rango de precio USD** automáticamente.
- **MercadoLibre**: URLs con región `bsas-gba-norte` + `?skipInApp=true&matt_ignore=true`.
  - Resuelve un challenge proof-of-work (`_bmstate` → `_bmc`) automáticamente.
  - Tope de paginación ~item 765 por búsqueda → se cubre con **split por precio** y
    **scrape por barrio** (que además etiqueta el barrio real de cada propiedad).
- El JSON se escribe en `apps/casas/data/properties.json`. La escritura es atómica con
  reintento (en Windows el antivirus a veces lockea el archivo).
- **No corras dos scrapes a la vez**: los dos escriben el mismo JSON y se pisan.
