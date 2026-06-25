---
name: actualizar-casas
description: Actualiza la base de propiedades de la app casas (scrapea ZonaProp/ArgenProp/MercadoLibre, valida el merge, corre cleanup+dedupe y deja todo listo para push). Usar cuando el usuario quiera "actualizar las casas", refrescar los listados, o correr el scraper.
---

# Actualizar la base de casas

Proceso end-to-end para refrescar los listados de propiedades de la app `casas`.
El scraper corre **local** (los sitios devuelven 403 desde la nube) y mergea contra
la base existente preservando historial.

## Contexto clave (rutas y gotchas)

- Scraper: `tools/casas-scraper/` — correr los `npm run` desde ahí.
- Base de listados (la que sirve la app): **`apps/casas/data/properties.json`**.
  El scraper lee/escribe ESE archivo. (El viejo `tools/webapp/data/` quedó deprecado.)
- Cookies ML: `tools/casas-scraper/.ml-cookies.txt` (gitignored, **expiran cada ~días**).
- Env de dedupe/cleanup: `apps/casas/.env.local` con `DATABASE_URL` (Postgres prod, gitignored).
- Doc humana equivalente: `tools/casas-scraper/ACTUALIZAR.md`.

## Pasos

1. **Preflight de cookies de ML.** Validá la sesión antes de scrapear:
   ```bash
   cd tools/casas-scraper
   npx tsx -e "import('./src/ml-fetch.ts').then(m=>m.preflightMl()).then(ok=>{console.log(ok?'OK':'COOKIES VENCIDAS');process.exit(ok?0:1)})"
   ```
   Si falla, guiá al usuario para refrescar `.ml-cookies.txt` (pasos en ACTUALIZAR.md:
   Chrome logueado en ML → DevTools → Network → request del documento → header `Cookie:`
   completo en una sola línea). Pedile que pegue la cookie y guardala con Write. Re-validá.
   ZonaProp y ArgenProp no necesitan cookies; si el usuario no quiere ML, seguí sin él.

2. **Env de prod** (solo si vas a correr cleanup/dedupe). Necesitás `apps/casas/.env.local`
   con un `POSTGRES_URL`/`DATABASE_URL` REAL (no vacío).
   ⚠️ **Gotcha:** las vars de Postgres son **"Sensitive"** en Vercel (integración Neon) →
   `vercel env pull` las trae **vacías** (`DATABASE_URL=""`). NO sirve para esto.
   Hay que copiar el string real a mano:
   - Vercel → scope `tcarides-projects` → **Storage** → base **`casas-db`** →
     pestaña **`.env.local`** → botón **"Show secret"** 👁️ → copiar el valor de
     **`POSTGRES_URL`** (pooled, host con `-pooler`).
   - Pegarlo en `apps/casas/.env.local` como `POSTGRES_URL` **y** `DATABASE_URL`
     (mismo valor). Pedí el string al usuario si no lo tenés.
   Verificá conexión con un `SELECT 1` vía `@vercel/postgres` antes de seguir.

3. **Scrape completo** (en background, ~15-20 min):
   ```bash
   cd tools/casas-scraper && npm run scrape:full > scrape.log 2>&1
   ```

4. **Validar la salida — CRÍTICO.** Confirmá que mergeó bien y no arrancó de cero:
   ```bash
   node -e '
   const p=JSON.parse(require("fs").readFileSync("apps/casas/data/properties.json","utf8"));
   const by={}; for(const x of p) by[x.source]=(by[x.source]||0)+1;
   const f=p.map(x=>x.firstSeenAt).filter(Boolean).sort();
   const hoy=new Date().toISOString().slice(0,10);
   const todasHoy=p.length>0 && f.every(x=>x.slice(0,10)===hoy);
   console.log("total:",p.length,"| fuentes:",JSON.stringify(by));
   console.log("firstSeenAt:",f[0],"→",f[f.length-1]);
   console.log(todasHoy?"🔴 BASE VACÍA — NO commitear":"✓ historial preservado");
   '
   ```
   Señales de corrida ROTA (no commitear, investigar): total se desploma (~8k vs ~13k),
   alguna fuente en 0 (ML=0 → cookies), o TODOS los `firstSeenAt` con fecha de hoy
   (arrancó de base vacía → el scraper no encontró/leyó `apps/casas/data/properties.json`).

5. **Cleanup + dedupe** (si hay `.env.local` con string real):
   ```bash
   cd tools/casas-scraper
   npm run cleanup    # marca avisos caídos (404/410); ~20-35 min (chequea cada URL)
   npm run dedupe     # phash + agrupa duplicados → escribe grupos DIRECTO al Postgres prod
   ```
   - `cleanup` SOLO escribe las caídas a Postgres si ve `DATABASE_URL` al arrancar.
     Si corriste cleanup SIN el string (quedaron solo en el JSON), después de
     cargarlo subilas sin re-chequear las URLs con: `npm run push-caidas`.

6. **Mostrar el diff y subir.** Resumí los cambios (cuántas nuevas, caídas, cambios de
   precio) y, con OK del usuario:
   ```bash
   git add apps/casas/data/properties.json
   git commit -m "Datos: actualiza properties.json"
   git push           # Vercel redeploya los listados automáticamente
   ```
   Los grupos de dedupe ya quedaron en Postgres (no necesitan deploy).

## Notas

- No corras dos scrapes a la vez (se pisan el mismo JSON).
- Nunca commitees `.ml-cookies.txt` ni `.env.local` (credenciales, ya gitignored).
- `scrape.log` es efímero (gitignored).
