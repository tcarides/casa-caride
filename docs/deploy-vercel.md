# Deploy en Vercel (Multi-Zones)

Casa Caride se deploya como **3 proyectos de Vercel desde este mismo repo**.
El shell vive en el dominio principal y reúne a las zonas (super, casas) bajo el
mismo origen vía rewrites. Las apps estáticas (olivia, fixture) las sirve el
propio shell desde `public/`.

| Proyecto Vercel | Root Directory | Para qué |
|---|---|---|
| `casa-caride` (shell) | `apps/shell` | Dominio principal + PWA (manifest, SW) |
| `casa-super` | `apps/super` | Zona `/super` (consumida por el shell) |
| `casa-casas` | `apps/casas` | Zona `/casas` (consumida por el shell) |

> **Tip:** nombrá los proyectos `casa-super` y `casa-casas` para que sus dominios
> sean predecibles (`https://casa-super.vercel.app`, `https://casa-casas.vercel.app`)
> y puedas setear las env del shell sin esperar al primer deploy.

## 1. Crear las zonas (super y casas)

Por cada zona, en el dashboard de Vercel → **Add New → Project** → importá el repo
`tcarides/casa-caride` y configurá:

- **Project Name:** `casa-super` (luego `casa-casas`).
- **Root Directory:** `apps/super` (luego `apps/casas`).
  Vercel detecta el monorepo (workspaces + Turborepo) y corre el `npm install` en
  la raíz automáticamente.
- **Framework Preset:** Next.js (autodetectado).
- **Build/Install/Output:** dejar por defecto.

### Base de datos de cada zona

Las zonas necesitan su base (la **misma** que ya usás en producción). Dos formas:

- **Reconectar la base existente (recomendado):** en el proyecto nuevo →
  **Storage** → conectá la base de Neon que ya tenías (la integración inyecta
  `DATABASE_URL` / `POSTGRES_URL` sola).
- **Copiar las env a mano:** del proyecto original (`listas-super` / `casas`) →
  Settings → Environment Variables → copiá `DATABASE_URL` / `POSTGRES_URL` al
  proyecto nuevo (entorno Production).

Deployá. Anotá la URL de producción de cada zona.

## 2. Crear el shell (dominio principal)

**Add New → Project** → mismo repo, otra vez:

- **Project Name:** `casa-caride`.
- **Root Directory:** `apps/shell`.
- **Environment Variables** (Production):

  ```
  SUPER_URL = https://casa-super.vercel.app
  CASAS_URL = https://casa-casas.vercel.app
  ```

  (Usá las URLs reales de las zonas del paso 1.)

Deployá. Este es el dominio que vas a usar e instalar como PWA.

> El shell falla el build a propósito si faltan `SUPER_URL`/`CASAS_URL` en Vercel,
> así no quedan rewrites apuntando a localhost por error.

## 3. Dominio propio (opcional)

En el proyecto `casa-caride` → **Domains** → agregá tu dominio (ej.
`casa.tudominio.com`). El manifest y el service worker ya usan rutas relativas,
así que la PWA se instala desde ese dominio sin tocar nada.

## Alternativa por CLI

```bash
npx vercel login
# Zona super
cd apps/super && npx vercel link && npx vercel --prod && cd ../..
# Zona casas
cd apps/casas && npx vercel link && npx vercel --prod && cd ../..
# Shell (después de setear SUPER_URL/CASAS_URL en el dashboard del proyecto)
cd apps/shell && npx vercel link && npx vercel --prod && cd ../..
```

La conexión de la base (Storage) se hace igual desde el dashboard.

## Troubleshooting

- **El shell muestra 401/404 al entrar a /super o /casas:** la zona tiene
  *Deployment Protection* activada. En el proyecto de la zona →
  Settings → Deployment Protection → dejá la producción pública (o configurá un
  *Protection Bypass* y pasalo en la env del shell).
- **Assets rotos en una zona (`/super/_next/...` 404):** verificá que la zona
  tenga `basePath` correcto en su `next.config` (`/super`, `/casas`).
- **"Falta la variable SUPER_URL":** seteá `SUPER_URL`/`CASAS_URL` en el proyecto
  del shell (Production) y redeployá.
- **La zona no encuentra la base:** confirmá que `DATABASE_URL`/`POSTGRES_URL`
  estén en el entorno **Production** del proyecto de la zona.
