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

## Mejoras de código (cuando haya tiempo)

- [ ] **UI optimista con recuperación en súper.** Al borrar/agregar ítems se actualiza la pantalla
  antes de confirmar con el server (con rollback vía re-fetch si falla); falta un undo explícito
  como el de casas.

## Hecho

- [x] **Migrar el lint a ESLint flat config.** `eslint.base.mjs` compartido (flat config nativo de
  `eslint-config-next` v16); las 5 apps tienen `"lint": "eslint ."` y el CI corre `npm run lint`.
- [x] **Pasar `apps/super` a TypeScript.** tsconfig strict, tipos compartidos en `lib/types`, page,
  layout, lib y route handlers tipados. Ya no queda `jsconfig.json`.
- [x] **Extraer un hook `useProperties()` en casas.** Centraliza estado, usuario, lightbox y los
  handlers de status/notas/discontinued (antes duplicados en home, oportunidades y caídas).
- [x] **Centralizar la hora de Argentina (UTC-3).** `apps/fabian/lib/time.ts` (`arNow`/`arDate`/`arSlot`),
  usado por el cliente y el cron.
- [x] **Tokens del design system en olivia y fixture.** Se reemplazaron los colores hardcodeados con
  token equivalente; olivia ya usaba las fuentes del DS vía `var(--font-sans)`.
