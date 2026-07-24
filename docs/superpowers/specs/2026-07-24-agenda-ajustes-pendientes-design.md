# Ajustes a las tarjetas pendientes de la Agenda

**Fecha:** 2026-07-24
**Estado:** Diseño aprobado — pendiente de plan de implementación

## Contexto

La Home muestra una "agenda" de eventos programados (`scheduled_events`): pagos
de deuda, cobros, cadenas, ahorros, recurrentes y payouts de plataforma. Cada
evento pendiente se abre en `ConfirmEventSheet`, que permite confirmar, abonar
parcial, cambiar de bolsillo, cambiar fecha, posponer y eliminar.

Hoy existen cuatro limitaciones que este trabajo resuelve:

1. Al cambiar la fecha de una ficha, el cambio puede no verse porque el evento
   sale del filtro de período actual (día/semana).
2. Las fichas con fecha **futura** no son accionables: el botón de acción solo
   aparece cuando `due_date <= hoy`, así que no se puede adelantar un pago/cobro.
3. Tras un **abono parcial**, el evento pasa a estado `'partial'` y desaparece de
   la agenda (el hook `useScheduledEvents` solo lee `status === 'pending'`). El
   restante queda guardado en `remaining_after_partial` pero nunca vuelve a ser
   accionable.
4. Una vez **confirmado** un pago, no hay forma de corregirlo si hubo un error
   (monto, bolsillo o fecha equivocados). Solo `platform_payout` tiene edición de
   monto, y únicamente antes de confirmar.

## Objetivos

- **#1** El cambio de fecha se refleja al instante en la agenda.
- **#2** Poder registrar pagos/cobros **adelantados** sobre fichas futuras, con
  toda la variedad de ajustes (completo, parcial, cambio de bolsillo).
- **#3** El restante de un abono parcial se puede **retomar y ajustar** cuando se
  quiera (abono libre).
- **#4** Corregir un pago ya confirmado por **dos** caminos: **deshacer** (revertir
  todo y volver a pendiente) y **editar en sitio** (cambiar monto/bolsillo/fecha
  con recálculo automático).

## No-objetivos (YAGNI)

- No se rediseña la UI de la Home ni de la agenda más allá de lo necesario.
- No se cambia la lógica de generación de eventos (`usePlatformPayouts`,
  `scheduleNext`, etc.) salvo lo que exija corregir/deshacer.
- No se toca la sincronización con Supabase más allá de reflejar los mismos
  cambios de estado que ya se replican.

## Diseño por punto

### #1 — Cambio de fecha inmediato

`rescheduleEvent(id, newDate)` ya hace `update` + `load()`. El problema es de
visualización: si la agenda está filtrada por "día"/"semana", el evento movido
puede caer fuera del filtro y "desaparecer" sin feedback.

**Solución:** tras un reschedule exitoso desde la Home, mostrar confirmación
visual ("Movido al DD/MM") y, si el nuevo día queda fuera del período/filtro
activo de la agenda, ajustar el filtro para que el evento siga visible (o al
menos no dejar al usuario en una vista donde el evento ya no aparece sin aviso).
Detalle exacto de UX a definir en el plan; la regla es: **el usuario siempre ve
el resultado del cambio de fecha**.

### #2 — Fichas futuras accionables (pagos/cobros adelantados)

En `HomePage.renderEventCard`, la variable `canConfirm = ev.due_date <= today`
oculta el botón de acción en fichas futuras.

**Solución:** toda ficha pendiente (incluidas las futuras) es accionable y abre
`ConfirmEventSheet` / `PlatformPayoutSheet` con **todas** las acciones. Se añade
en el panel un aviso claro cuando `due_date > hoy`:
*"Registrando antes de su fecha (DD/MM)"*.

Semántica del dinero (ya correcta, se conserva): el movimiento se registra con la
fecha de **hoy** (`todayISO()`), porque el dinero se mueve hoy. La próxima cuota
de recurrentes/deudas se sigue calculando desde `prev.due_date` (no se corre el
calendario por adelantar el pago).

Incluye la variedad pedida: pago adelantado, cobro adelantado y cobro/abono
parcial con cambio de bolsillo, todo reutilizando los modos existentes del sheet.

### #3 — Restante del parcial, accionable (abono libre)

Cambio de mecánica en `partialEvent`: en vez de dejar el evento en estado
`'partial'` (que lo saca de la agenda), el evento **permanece pendiente** con su
`amount` reducido al restante (`amount - paidAmount`). Así el usuario puede
volver a tocarlo cuantas veces quiera: abonar otra parte, completarlo, o cambiar
de bolsillo. Cada abono:

- Mueve dinero y registra su transacción (como hoy).
- Suma al avance del registro origen (`paid_amount` / `collected_amount` /
  `saved_amount`), como hoy.
- Reduce el `amount` de la ficha al nuevo restante.

Cuando un abono completa la cuota (o el usuario confirma el restante completo),
recién ahí se dispara `scheduleNext` / cierre, igual que hoy en un confirm total.
"Abono libre": no se bloquea nada; el restante es la nueva cuota visible de la
ficha y el usuario decide.

**Migración de datos:** las fichas existentes en estado `'partial'` deben volver a
mostrarse. Opción a definir en el plan: (a) `load()` incluye `'partial'` y las
trata con su `remaining_after_partial` como monto; o (b) una migración única que
convierte `'partial'` pendientes a `pending` con `amount = remaining_after_partial`.
Se prefiere (b) por dejar un solo modelo mental (siempre `pending` + `amount`),
pero se decide en el plan según riesgo.

### #4 — Corregir un pago confirmado (deshacer + editar en sitio)

Se agrega la capacidad de corregir eventos ya `confirmed`.

**Visibilidad — ambos lugares:**
- **Home:** una sección compacta "Confirmados recientes" (p. ej. confirmados hoy
  / últimos N) bajo la agenda, cada uno con botón **Corregir**.
- **Historial:** desde la página de Historial de movimientos, cada movimiento
  originado por un evento confirmado permite Corregir/Deshacer.

**Deshacer (`reverseEvent`):** en una transacción Dexie atómica —
- Devolver el saldo al bolsillo (`adjustPocket` con signo inverso al del tipo).
- Borrar la(s) transacción(es) generada(s) por ese evento
  (`transactions.reference_id === event.reference_id` de ese confirm; ver nota).
- Revertir el avance del registro origen (restar de `paid_amount` /
  `collected_amount` / `saved_amount`; en cadena bajar `paid_rounds`/`current_round`
  y revertir `status` si pasó a completed/paid_off/fully_collected).
- Eliminar el evento "siguiente" creado por `scheduleNext` si aplica y sigue
  pendiente e intacto.
- Volver el evento a `status: 'pending'` (limpiando `actual_pocket_id`,
  `partial_amount`, `remaining_after_partial`).

**Editar en sitio (`editConfirmedEvent`):** cambiar monto / bolsillo / fecha del
pago confirmado recalculando diferencias, generalizando el patrón que ya existe
en `onEditAmount` de `PlatformPayoutSheet`:
- **Monto:** ajustar saldo por el delta y actualizar el `amount` de la
  transacción y el avance del registro origen por el mismo delta.
- **Bolsillo:** devolver al bolsillo viejo y descontar del nuevo (o inverso según
  tipo), y reasignar `pocket_id` de la transacción.
- **Fecha:** actualizar la fecha de la transacción (y `due_date` si corresponde).

**Nota de identificación de transacciones:** hoy las transacciones se etiquetan
con `reference_id`/`reference_type` del evento, no con el `event.id`. Para
deshacer/editar con precisión conviene poder ligar la transacción a su evento.
El plan evaluará añadir `event_id` (o `scheduled_event_id`) a `transactions`, o
identificar la transacción por (`reference_id`, `date`, `amount`, `pocket_id`).
Preferencia: añadir `event_id` para robustez; decisión final en el plan.

## Componentes afectados (previsto)

- `src/hooks/useScheduledEvents.ts` — `partialEvent` (mecánica de restante),
  `load()` (incluir confirmados recientes y/o partial), nuevos `reverseEvent`,
  `editConfirmedEvent`.
- `src/components/shared/ConfirmEventSheet.tsx` — aviso de adelanto; modo
  "corregir" (deshacer + editar) para eventos confirmados.
- `src/pages/home/HomePage.tsx` — fichas futuras accionables; sección
  "Confirmados recientes"; feedback de reschedule.
- `src/pages/history/*` — acceso a Corregir/Deshacer desde el historial.
- `src/types/index.ts` y migración Supabase — posible `event_id` en
  `transactions`; posible migración de estados `'partial'`.

## Riesgos y consideraciones

- **Integridad de saldos** es el riesgo central (memoria del proyecto: un
  chequeo previo llegó a corromper saldos). Toda reversión/edición debe ser
  atómica (transacción Dexie), con pruebas que verifiquen: saldo del bolsillo,
  monto/borrado de la transacción, avance del registro origen y estado del
  evento — antes y después.
- **Doble reversión / doble edición**: reusar el patrón de guard atómico de
  `confirmEvent` (releer estado dentro de la transacción).
- **Eventos "siguientes" ya tocados**: si `scheduleNext` creó el próximo evento y
  el usuario ya lo confirmó/abonó, deshacer NO debe romper esa cadena; se
  detecta y se avisa en vez de borrar a ciegas.
- **TDD obligatorio** para la lógica de reversión/edición y para la nueva
  mecánica de parcial (ver riesgo de integridad).

## Criterios de éxito

- Puedo abrir y registrar un pago/cobro de una ficha con fecha futura, con aviso
  de adelanto, incluyendo parcial y cambio de bolsillo.
- Tras un abono parcial, la ficha sigue en la agenda con el restante y la puedo
  seguir ajustando/completando.
- Cambiar la fecha de una ficha se refleja al instante y no "desaparece" sin
  aviso.
- Puedo deshacer un pago confirmado y todo vuelve a su estado previo (saldo,
  transacción, avance, evento), verificado por pruebas.
- Puedo editar en sitio monto/bolsillo/fecha de un pago confirmado y los saldos
  y transacciones quedan consistentes, desde la Home y desde el Historial.
