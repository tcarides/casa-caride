# Deploy a Vercel

## Setup inicial (una sola vez)

### 1. Importar el repo a Vercel
- Ir a https://vercel.com/new
- Importar `tcarides/casas`
- Vercel detecta el `vercel.json` y configura el build automáticamente
- Click en **Deploy** (va a fallar la primera vez si la DB no está creada — está bien)

### 2. Crear la base de datos
- En el proyecto de Vercel: **Storage → Create Database → Postgres (Neon)**
- Connect to project: marcá Production, Preview y Development
- Vercel inyecta automáticamente las variables: `DATABASE_URL`, `POSTGRES_URL`, etc.

### 3. Correr la migración (en local, una vez)
```bash
cd webapp
npx vercel link        # vincula el proyecto local con el de Vercel
npx vercel env pull    # baja .env.local con las credenciales de la DB
npm run db:migrate     # crea la tabla property_state
```

### 4. Re-deployar
- En Vercel: **Deployments → Redeploy** la última build
- O simplemente pushear cualquier cambio: Vercel auto-deploya

## Workflow normal

### Actualizar propiedades
```bash
cd scraper
npm run scrape         # scrapea y actualiza webapp/data/properties.json
git add webapp/data/properties.json
git commit -m "data: sync $(date +%Y-%m-%d)"
git push               # Vercel re-deploya con la data nueva
```

### Limpiar listings dados de baja
```bash
cd scraper
npm run cleanup        # revisa URLs y elimina las que devuelven 410/404
git add webapp/data/properties.json && git commit -m "data: cleanup" && git push
```

## Local dev

### Sin DB (rápido, status/notes se guardan al JSON)
```bash
cd webapp && npm run dev
```

### Con DB (igual a producción)
```bash
cd webapp
npx vercel env pull   # actualiza .env.local
npm run dev
```

## Arquitectura

| Cosa | Dónde | Por qué |
|---|---|---|
| Propiedades (precio, fotos, etc.) | `webapp/data/properties.json` (en el repo) | Sin DB, frozen al deploy |
| Status + notas del usuario | Postgres `property_state` | Mutable, persiste entre deploys |
| Scraper | Local solamente (no corre en Vercel) | Necesita curl + procesos |
