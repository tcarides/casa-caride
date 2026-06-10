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

## Mejoras de código (cuando haya tiempo)

- [ ] **Migrar el lint a ESLint flat config.** `next lint` quedó deprecado en Next 16; el script
  `"lint": "next lint"` está roto en las 4 apps (por eso el CI usa solo `build`, que igual
  hace type-check).
- [ ] **Pasar `apps/super` a TypeScript.** Es la única app en JS (`jsconfig.json`); el resto del
  monorepo es TS.
- [ ] **UI optimista con recuperación en súper.** Al borrar/agregar ítems se actualiza la pantalla
  antes de confirmar con el server; falta feedback/undo si la red falla.
- [ ] **Extraer un hook `useProperties()` en casas.** `loadProperties` + `handleStatusChange` están
  duplicados casi idénticos en home, oportunidades y caídas.
- [ ] **Centralizar la hora de Argentina (UTC-3).** La lógica está copiada en el cliente de fabián
  y en el cron; conviene un helper compartido.
- [ ] **Tokens del design system en olivia y fixture.** Quedan colores hardcodeados (`#181818`,
  `#1b1f2b`, rgba sueltos) que ya existen como tokens; olivia además carga fuentes distintas a las del DS.
