# Pendientes

## Seguridad (requiere acceso a Vercel)

- [ ] **Rotar las claves VAPID de Fabián.**
  Las claves originales quedaron en el historial de git, así que conviene regenerarlas.
  1. `npx web-push generate-vapid-keys`
  2. En el proyecto `casa-caride-fabian` (Vercel → Settings → Environment Variables), actualizar:
     `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= la pública), `VAPID_SUBJECT`.
  3. Redeploy.
  > Al rotar, las suscripciones viejas dejan de valer: Tomás y Flori tienen que volver a tocar 🔕 para re-suscribirse.

## A definir (necesitan decisión, no son "just do it")

- [ ] **Etapa 6 — identidad de Google en lugar del selector tomi/flori** en casas y Fabián.
  Ahora que la identidad de zona funciona, es factible (el JWT ya trae `userId`). Es un cambio de UX.
- [ ] **Scoping de cuentas por usuario** en Cuentas Claras (hoy las cuentas son compartidas; los grupos
  ya son privados). Requiere **vincular participante ↔ usuario** (por email) para que una cuenta la
  vean todos sus participantes.
- [ ] **Recordatorios automáticos de deudas por WhatsApp** (cron). Necesita la WhatsApp Business API
  (aprobación + costo). El recordatorio manual con `wa.me` ya está.
- [ ] **División no equitativa** (montos o subconjunto por gasto) y **multi-moneda** (hoy ARS, partes iguales).

## Hardening opcional

- [ ] **Proteger las APIs de las zonas ante acceso directo.** El gate de zona (etapa 5) cubre las
  páginas; las rutas `/api/*` de cada zona siguen accesibles por la URL directa del proyecto. Para
  datos sensibles (Olivia) conviene además gatear las rutas API (chequear sesión en cada handler).

## Mejoras de código (cuando haya tiempo)

- [ ] **UI optimista con recuperación en súper** (undo explícito como en casas).
- [ ] **Paquete compartido de auth de zona** (`lib/identity` está duplicado en cada zona).
- [ ] **`packages/db`** para no repetir `getSql`/`ensureSchema` en cada app.
- [ ] **Limpiar warnings de `react-hooks` v6** (`set-state-in-effect`, `refs`).
- [ ] **Test del cálculo de deudas** (`apps/cuentas-claras/lib/calc.ts`); hoy verificado a mano.

## Hecho

- [x] **Login con Google (Auth.js v5)**: allowlist, gate de toda la PWA, authz por-app, `/admin`
  (usuarios × apps + alta), invitaciones por WhatsApp (de 1 persona o **multi-uso**). **Deployado.**
- [x] **Identidad de zona validada** (la cookie del shell llega a las zonas) + **etapa 5**: gate de
  acceso directo en las 5 zonas (super, casas, olivia, fabián, cuentas-claras). **Deployado.**
- [x] **Cuentas Claras** (app nueva): divisor de gastos (partes iguales), comprobantes con foto (Blob),
  estado de carga por participante + bloqueo de cierre, grupos de contactos privados, **editar gasto**,
  **borrar cuenta**, UX optimista. **Deployado.**
- [x] **Fixture**: posiciones y resultados en vivo, llaves eliminatorias con puestos ya definidos.
- [x] **`CRON_SECRET` + VAPID** seteados en Fabián (redeploy hecho).
- [x] **Migrar el lint a ESLint flat config** + CI corre `npm run lint`.
- [x] **`apps/super` a TypeScript.**
- [x] **Hook `useProperties()` en casas.**
- [x] **Hora de Argentina (UTC-3) centralizada** en `apps/fabian/lib/time.ts`.
- [x] **Tokens del design system en olivia y fixture.**
