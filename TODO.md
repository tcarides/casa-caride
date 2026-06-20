# Pendientes

## Seguridad (requiere acceso a Vercel)

- [ ] **Rotar las claves VAPID de Fabián.**
  Las claves originales quedaron en el historial de git, así que conviene regenerarlas.
  1. `npx web-push generate-vapid-keys`
  2. En el proyecto `casa-caride-fabian` (Vercel → Settings → Environment Variables), actualizar:
     `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= la pública), `VAPID_SUBJECT`.
  3. Redeploy.
  > Al rotar, las suscripciones viejas dejan de valer: Tomás y Flori tienen que volver a tocar 🔕 para re-suscribirse.

- [ ] **Setear `CRON_SECRET` en `casa-caride-fabian`** (Vercel → Settings → Environment Variables).
  Vercel lo manda como `Authorization: Bearer` en cada ejecución del cron, así el endpoint
  `/fabian/api/cron/notify` queda cerrado a cualquier llamada externa.
  > El código ya exige el secret: en producción, si falta `CRON_SECRET`, el endpoint responde 503.

## Auth — terminar (después del primer deploy de la branch)

- [ ] **Validar la identidad de zona en un deploy.** Confirmar que la cookie de sesión del apex
  llega a las zonas vía rewrite. De esto dependen las etapas 5-6 y el scoping de Cuentas Claras.
- [ ] **Etapa 5 — gate de sesión en las zonas.** Middleware liviano en super/casas/fabian/olivia/
  cuentas-claras que valida el JWT (con `AUTH_SECRET` en cada proyecto). Cierra el acceso directo a
  las URLs de zona (`casa-super.vercel.app`, etc.).
- [ ] **Etapa 6 — identidad de Google en lugar del selector tomi/flori** en casas y Fabián.

## Cuentas Claras (después de validar identidad de zona)

- [ ] **Scoping por usuario.** Que cada uno vea solo sus cuentas y grupos (hoy es compartido entre
  los usuarios de la PWA). Depende de la identidad de zona.
- [ ] **Vincular participante ↔ usuario de la app** (por email): para "cada uno carga lo suyo" y
  futuras notificaciones.
- [ ] **Editar un gasto** (hoy solo se puede borrar y recrear).
- [ ] **Borrar una cuenta desde la UI** (el endpoint DELETE ya existe, falta el botón).
- [ ] **Recordatorios automáticos de deudas por WhatsApp** (cron). El recordatorio manual con
  `wa.me` ya está.
- [ ] **División no equitativa** (montos o subconjunto por gasto) y **multi-moneda** (hoy ARS, partes
  iguales).

## Infra / deploy

- [ ] **Activar "Skip deployments" (built-in de Turbo) en los proyectos Vercel** para no quedarse sin
  deploys del plan free (un push deploya solo las apps que cambiaron). Ya hecho en `casa-caride-fabian`.
- [ ] **Crear el proyecto `casa-caride-cuentas-claras`** (Root `apps/cuentas-claras`) con `DATABASE_URL`
  (Neon), `BLOB_READ_WRITE_TOKEN` (Blob) y `AUTH_SECRET`; y `CUENTAS_CLARAS_URL` en el shell.

## Mejoras de código (cuando haya tiempo)

- [ ] **UI optimista con recuperación en súper.** Al borrar/agregar ítems se actualiza la pantalla
  antes de confirmar con el server (con rollback vía re-fetch si falla); falta un undo explícito
  como el de casas.
- [ ] **Paquete compartido de auth de zona** (config mínima + `lib/identity`) cuando hagamos la etapa 5,
  para no duplicarlo en cada zona.
- [ ] **Considerar un `packages/db`** para no repetir `getSql`/`ensureSchema` en cada app.
- [ ] **Limpiar los warnings de `react-hooks` v6** (`set-state-in-effect`, `refs`) que dejamos como
  warning al migrar el lint.
- [ ] **Test del cálculo de deudas** (`apps/cuentas-claras/lib/calc.ts`); hoy está verificado a mano.

## Hecho

- [x] **Login con Google (Auth.js v5) + allowlist + gate + authz por-app + `/admin` + invitaciones
  por WhatsApp** (etapas 1-4, en la branch; falta deploy).
- [x] **Cuentas Claras**: divisor de gastos (partes iguales), comprobantes con foto, estado de carga
  por participante, grupos de contactos privados, UX optimista (en la branch; falta deploy).
- [x] **Migrar el lint a ESLint flat config.** `eslint.base.mjs` compartido; las apps tienen
  `"lint": "eslint ."` y el CI corre `npm run lint`.
- [x] **Pasar `apps/super` a TypeScript.** tsconfig strict, tipos compartidos, route handlers tipados.
- [x] **Extraer un hook `useProperties()` en casas.** Saca la duplicación de home/oportunidades/caídas.
- [x] **Centralizar la hora de Argentina (UTC-3)** en `apps/fabian/lib/time.ts`.
- [x] **Tokens del design system en olivia y fixture.**
