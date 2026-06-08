# Traer los datos de super y casas a local

Los datos **no están en el repo**: viven en las bases en la nube de tus
proyectos originales de Vercel.

- **super** → todo en Neon (Postgres).
- **casas** → el catálogo está en `data/properties.json` (sí está en el repo);
  tus favoritos/notas/descartados están en Vercel Postgres.

Para verlos en local apuntamos cada app a la **misma** base con un `.env.local`.
No se migra ni se mueve nada: es la misma base que usa producción.

## Pasos (en tu terminal, desde la raíz del repo)

### 1. Login (una sola vez)
```bash
npx vercel login
```
Elegí tu método (mail `tomascaride@gmail.com` o GitHub `tcarides`).

### 2. super → base Neon
```bash
cd apps/super
npx vercel link                                      # Link to existing project? Y -> elegí: listas-super
npx vercel env pull .env.local --environment=production
cd ../..
```

### 3. casas → Vercel Postgres
```bash
cd apps/casas
npx vercel link                                      # elegí: casas
npx vercel env pull .env.local --environment=production
cd ../..
```

### 4. Levantar y verificar
```bash
npm run dev
```
Abrí http://localhost:3000/super y http://localhost:3000/casas → ahora se ven
los datos reales.

## Notas

- `--environment=production` asegura traer la cadena de la base (suele estar
  sólo en el entorno Production). Si también está en Development, alcanza con
  `npx vercel env pull .env.local`.
- Los `.env.local` están **gitignoreados** (`.env*.local`): los secretos nunca
  se commitean.
- `vercel link` crea una carpeta `.vercel/` por app (también gitignoreada) que
  recuerda a qué proyecto está vinculada.
- Variables que esperan las apps: super lee `DATABASE_URL` / `POSTGRES_URL` /
  `POSTGRES_PRISMA_URL`; casas lee `DATABASE_URL` / `POSTGRES_URL`. La
  integración de Neon en Vercel ya las setea con esos nombres.
