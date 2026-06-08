# 🏡 Casa Caride

Una sola **PWA** que reúne las mini-apps de la familia. El usuario instala
**una** app en la pantalla de inicio y adentro tiene todo:

| Mini-app | Ruta | Tipo | Origen |
|---|---|---|---|
| 🛒 Lista del súper | `/super` | App Next.js (zona) | repo `listas-super` |
| 🏠 Compra de casas | `/casas` | App Next.js (zona) | repo `casas` |
| 👶 Olivia (paternidad) | `/olivia` | Estática (HTML/CSS/JS) | repo `olivia` |
| ⚽ Fixture Mundial | `/fixture` | Estática (HTML) | repo `fixture-mundial` |

## La idea de la arquitectura

Una PWA se instala **por origen** (dominio). Para que todo sea **una sola app
instalable** —un ícono, login compartido, offline común— todas las mini-apps
viven bajo el mismo dominio en rutas distintas.

Eso se logra con el patrón **Multi-Zones de Next.js**:

```
            casa.tudominio.com  (un solo origen)
                     │
        ┌────────────┴─────────────┐
        │   apps/shell (launcher)  │  ← manifest + service worker (PWA)
        └────────────┬─────────────┘
         rewrites en next.config.ts
   ┌───────────┬─────────┴───────┬────────────┐
   ▼           ▼                 ▼            ▼
/super      /casas            /olivia      /fixture
(zona Next) (zona Next)     (public/)    (public/)
```

- El **shell** es el host de la PWA: sirve el launcher, el `manifest.webmanifest`
  y el `sw.js` en la raíz (`scope: "/"` → cubre todas las mini-apps).
- Las apps **Next** (`super`, `casas`) se mantienen como apps independientes con
  su propia base de datos. Sólo se les agregó `basePath` (`/super`, `/casas`) y
  se les quitó el service worker propio (lo provee el shell).
- Las apps **estáticas** (`olivia`, `fixture`) se copian a `apps/shell/public/`
  y se sirven bajo el mismo origen sin necesidad de deploy aparte.
- Cada mini-app tiene un botón flotante 🏡 para volver al launcher.

## Estructura

```
casa-caride/
├── apps/
│   ├── shell/      # launcher + PWA (manifest, service worker, íconos)
│   │   └── public/
│   │       ├── olivia/    # app estática servida en /olivia
│   │       └── fixture/   # app estática servida en /fixture
│   ├── super/      # listas-super (Next 15, basePath /super, DB Neon)
│   └── casas/      # compra de casas (Next 16, basePath /casas, DB Postgres)
├── tools/          # scraper y extensión de casas (no se deployan)
├── packages/       # (futuro) UI y auth compartidos
├── turbo.json
└── package.json    # workspaces npm + turbo
```

## Desarrollo local

```bash
npm install
npm run dev
```

Levanta los 3 servers con Turborepo y abrís **todo desde el shell**:

- http://localhost:3000 → launcher
- http://localhost:3000/super, /casas, /olivia, /fixture

(Internamente las zonas corren en 3001 y 3002; el shell las reescribe. Nunca
hace falta abrir esos puertos directamente.)

Para que las zonas funcionen con datos, copiá sus `.env.example` a `.env.local`:

- `apps/super/.env.example` → `DATABASE_URL` (Neon)
- `apps/casas` → variables de `@vercel/postgres`

## Deploy en Vercel (Multi-Zones)

Se crean **3 proyectos** en Vercel desde este mismo repo (cada uno con su *Root
Directory*):

| Proyecto Vercel | Root Directory | Dominio |
|---|---|---|
| `casa-caride` (shell) | `apps/shell` | dominio principal (apex) |
| `casa-super` | `apps/super` | interno (lo consume el shell) |
| `casa-casas` | `apps/casas` | interno (lo consume el shell) |

En el proyecto del **shell**, configurar variables de entorno con las URLs de
las zonas:

```
SUPER_URL = https://casa-super.vercel.app
CASAS_URL = https://casa-casas.vercel.app
```

Cada zona mantiene sus propias variables de base de datos. El shell sirve el
manifest y el service worker, así que la PWA se instala una sola vez desde el
dominio principal.

## Agregar una nueva mini-app

1. Si es **estática**: copiala a `apps/shell/public/<slug>/` y agregá un rewrite
   de URL limpia en `apps/shell/next.config.ts`.
2. Si es **Next**: copiala a `apps/<slug>/`, ponele `basePath: '/<slug>'`,
   sacale cualquier service worker propio, y agregá la zona en los `rewrites`
   del shell.
3. Sumá la entrada en `apps/shell/app/apps.config.ts` para que aparezca el tile
   en el launcher.
