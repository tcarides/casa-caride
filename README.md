# 🏡 Casa Caride

Una sola **PWA** que reúne las mini-apps de la familia. El usuario instala
**una** app en la pantalla de inicio y adentro tiene todo:

| Mini-app | Ruta | Tipo | Acceso | Para qué |
|---|---|---|---|---|
| 🛒 Lista del súper | `/super` | Zona Next.js | Con permiso | La compra compartida de Flor y Tomás |
| 🏠 Compra de casas | `/casas` | Zona Next.js | Con permiso | Propiedades, mapa y favoritos |
| 👶 Olivia | `/olivia` | Zona Next.js | Con permiso | Historia clínica del embarazo |
| 🐶 Fabián | `/fabian` | Zona Next.js | Con permiso | La medicación del perro, cada 12 h (push) |
| 🧾 Cuentas Claras | `/cuentas-claras` | Zona Next.js | Abierta (login) | Dividí asados y eventos sin vueltas |
| ⚽ Fixture Mundial | `/fixture` | Estática (HTML) | Pública | Argentina, calendario, grupos y llaves 2026 |

> La lista viva de mini-apps es `apps/shell/app/apps.config.ts` (fuente de verdad
> del launcher). Los niveles de acceso: **pública** (sin login), **abierta** (se
> ve deslogueada pero pide login al entrar) y **con permiso** (login + permiso del
> admin).

## La idea de la arquitectura

Una PWA se instala **por origen** (dominio). Para que todo sea **una sola app
instalable** —un ícono, login compartido, offline común— todas las mini-apps
viven bajo el mismo dominio en rutas distintas.

Eso se logra con el patrón **Multi-Zones de Next.js**:

```
                  casa-caride  (un solo origen)
                        │
          ┌─────────────┴──────────────┐
          │    apps/shell (launcher)   │  ← manifest + service worker (PWA)
          └─────────────┬──────────────┘
             rewrites en next.config.ts
  ┌───────┬───────┬─────┴───┬─────────┬────────────────┬───────────┐
  ▼       ▼       ▼         ▼         ▼                ▼
/super  /casas  /olivia  /fabian  /cuentas-claras   /fixture
(zona)  (zona)  (zona)   (zona)   (zona)            (public/)
```

- El **shell** es el host de la PWA: sirve el launcher, el `manifest.webmanifest`
  y el `sw.js` en la raíz (`scope: "/"` → cubre todas las mini-apps), más el
  login compartido (Auth.js) y los íconos.
- Las apps **Next** (`super`, `casas`, `olivia`, `fabian`, `cuentas-claras`) son
  apps independientes con su propia base de datos. Sólo se les agregó
  `basePath` (`/<slug>`) y se les quitó el service worker propio (lo provee el
  shell). `super` y `casas` son zonas **core** (obligatorias); `olivia`,
  `fabian` y `cuentas-claras` son **opcionales**: si falta su `_URL` el shell no
  rompe, sólo no muestra esa zona.
- Las apps **estáticas** (`fixture`) se sirven desde `apps/shell/public/` bajo el
  mismo origen, sin deploy aparte.
- Cada mini-app tiene un botón flotante 🏡 para volver al launcher.

## Estructura

```
casa-caride/
├── apps/
│   ├── shell/            # launcher + PWA (manifest, service worker, íconos, login)
│   │   └── public/
│   │       └── fixture/  # app estática servida en /fixture
│   ├── super/            # Lista del súper (Next, basePath /super, DB Neon)
│   ├── casas/            # Compra de casas (Next, basePath /casas, DB Postgres)
│   ├── olivia/           # Olivia (Next, basePath /olivia)
│   ├── fabian/           # Fabián (Next, basePath /fabian, push + cron)
│   └── cuentas-claras/   # Cuentas Claras (Next, basePath /cuentas-claras, DB Neon)
├── tools/                # scraper de casas (no se deploya)
├── packages/             # (futuro) UI y auth compartidos
├── turbo.json
└── package.json          # workspaces npm + turbo
```

## Desarrollo local

```bash
npm install
npm run dev
```

Levanta el shell + las zonas con Turborepo y abrís **todo desde el shell**:

- http://localhost:3000 → launcher
- http://localhost:3000/super, /casas, /olivia, /fabian, /cuentas-claras, /fixture

(Internamente las zonas corren en 3001–3005 y el shell las reescribe. Nunca hace
falta abrir esos puertos directamente.)

Para que las zonas funcionen con datos, copiá sus `.env.example` a `.env.local`.
Además, el login compartido (Auth.js) necesita el **mismo `AUTH_SECRET`** en el
shell y en todas las zonas.

- `apps/shell/.env.example` → `AUTH_SECRET`, `AUTH_URL`, Google OAuth, `*_URL` de las zonas
- `apps/super/.env.example` → `DATABASE_URL` (Neon)
- `apps/casas/.env.example` → variables de `@vercel/postgres`
- `apps/fabian/.env.example` → `DATABASE_URL` (Postgres) + claves VAPID (push) y cron
- `apps/cuentas-claras` → `DATABASE_URL` (Neon) — configurala en Vercel (esta zona no trae `.env.example`)

## Deploy en Vercel (Multi-Zones)

> Runbook paso a paso (con bases de datos y troubleshooting):
> [docs/deploy-vercel.md](docs/deploy-vercel.md).

Se crea **un proyecto Vercel por app** desde este mismo repo (cada uno con su
*Root Directory*):

| Proyecto Vercel | Root Directory | Dominio |
|---|---|---|
| `casa-caride` (shell) | `apps/shell` | dominio principal (apex) |
| `casa-super` | `apps/super` | interno (lo consume el shell) |
| `casa-casas` | `apps/casas` | interno (lo consume el shell) |
| `casa-olivia` | `apps/olivia` | interno (lo consume el shell) |
| `casa-fabian` | `apps/fabian` | interno (lo consume el shell) |
| `casa-cuentas-claras` | `apps/cuentas-claras` | interno (lo consume el shell) |

En el proyecto del **shell**, configurar las URLs de las zonas y el secreto de
auth compartido:

```
SUPER_URL           = https://casa-super.vercel.app
CASAS_URL           = https://casa-casas.vercel.app
OLIVIA_URL          = https://casa-olivia.vercel.app
FABIAN_URL          = https://casa-fabian.vercel.app
CUENTAS_CLARAS_URL  = https://casa-cuentas-claras.vercel.app
AUTH_SECRET         = <el mismo en shell y en todas las zonas>
```

Cada zona mantiene sus propias variables de base de datos. El shell sirve el
manifest y el service worker, así que la PWA se instala una sola vez desde el
dominio principal.

## Agregar una nueva mini-app

1. Si es **estática**: copiala a `apps/shell/public/<slug>/` y agregá un rewrite
   de URL limpia en `apps/shell/next.config.ts`.
2. Si es **Next**: copiala a `apps/<slug>/`, ponele `basePath: '/<slug>'`,
   sacale cualquier service worker propio, y agregá la zona en los `rewrites`
   del shell (opcional: envolvela en `if (<SLUG>_URL)` para que no rompa si falta).
3. Sumá la entrada en `apps/shell/app/apps.config.ts` para que aparezca el tile
   en el launcher (con su `emoji`, `hue` y `access`).
4. **Favicon (norma):** en el `metadata` del `layout` de la app, usá siempre el
   ícono de Casa Caride servido por el shell (no uno propio):

   ```ts
   icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' }
   ```

   Los assets viven en `apps/shell/public/` y se sirven desde el apex, así que
   todas las apps comparten el mismo favicon.
