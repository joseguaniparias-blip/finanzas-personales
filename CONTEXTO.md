# Contexto General — Mis Finanzas (Finanzas Personales PWA)

> Documento maestro del proyecto. Si vas a tocar el código sin haber leído nada,
> empieza por aquí. Los errores arquitectónicos cometidos están documentados
> al final para no repetirlos.

---

## 1. Propósito del proyecto

**Mis Finanzas** es una PWA de control financiero diseñada específicamente para
**trabajadores de apps de delivery** (Rappi, Uber, DiDi, Yango) en Colombia.

### El problema que resuelve

Los repartidores tienen un flujo de dinero peculiar:
- Ganan plata todos los días, **pero la plataforma les paga semanalmente**
  (cada plataforma tiene su propio día de pago: martes, jueves, etc.)
- Mezclan dinero digital (que cobran después) con efectivo (que reciben al instante)
- Tienen ingresos paralelos: cobros a terceros (vendieron algo, prestaron plata),
  deudas en cuotas, ahorros, **cadenas de ahorro** (sistema rotativo entre amigos)
- Necesitan saber: cuánto tienen **AHORA**, cuánto les **VAN A PAGAR**, qué deben
  pagar, qué deben cobrar, y todo eso desde el celular

### Filosofía de diseño

- **Mobile-first** (se usa parado en una moto entre pedidos)
- **Offline-first**: IndexedDB local, sincronización en background a Supabase
- **PWA**: instalable como app nativa, sin friction de App/Play Store
- **Visual y rápido**: tarjetas grandes, una acción principal por pantalla
- **Tolerante al error humano**: posibilidad de editar, posponer, eliminar
  cualquier registro

---

## 2. Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| UI | React 19 + TypeScript estricto | Type-safety, ecosistema |
| Build | Vite | Rápido, HMR instantáneo |
| Estilos | Tailwind CSS v4 | Mobile-first nativo, sin CSS escrito |
| Routing | React Router v7 | Pages declarativas |
| DB local | Dexie (wrapper de IndexedDB) | Offline-first, queries por índices |
| DB cloud | Supabase (Postgres + Auth) | Sync, multi-dispositivo |
| Iconos | Lucide React | Pesa poco, consistente |
| PWA | vite-plugin-pwa (Workbox) | Service worker auto-update |
| Tests | Vitest + Testing Library | Co-ubicado con código |

---

## 3. Arquitectura

### 3.1 Estructura de directorios

```
src/
├── App.tsx                  # Router + auth gate + onboarding gate
├── main.tsx                 # Entry, registra SW
│
├── lib/                     # Capa de datos pura
│   ├── db.ts                # Schema Dexie (10 tablas), hooks bool→0/1
│   ├── supabase.ts          # Cliente Supabase
│   └── sync.ts              # Sync bidireccional Dexie↔Supabase
│
├── types/index.ts           # Todos los tipos del dominio
│
├── hooks/                   # Capa de lógica de negocio
│   ├── useAuth.ts           # Sesión Supabase
│   ├── usePockets.ts        # Bolsillos (cuentas/billeteras)
│   ├── usePlatforms.ts      # Plataformas (Rappi, Uber…)
│   ├── usePlatformPayouts.ts # Cierre semanal de plataformas
│   ├── useTransactions.ts   # Movimientos (income/expense/transfer)
│   ├── useCategories.ts     # Categorías de gasto
│   ├── useDebts.ts          # Deudas
│   ├── useCollections.ts    # Cobros (lo que me deben)
│   ├── useSavingGoals.ts    # Metas de ahorro
│   ├── useCadenas.ts        # Cadenas (juntas rotativas)
│   ├── useScheduledEvents.ts # Agenda unificada (eventos pendientes)
│   ├── useUserProfile.ts    # Perfil
│   └── useSubmitLock.ts     # Lock síncrono anti-doble-submit
│
├── components/
│   ├── layout/              # AppShell + BottomNav
│   └── shared/              # Componentes reutilizables
│       ├── AmountInput.tsx  # Input con formato $ es-CO
│       ├── ConfirmEventSheet.tsx  # Bottom-sheet de confirmación
│       └── ...
│
└── pages/                   # Una carpeta por feature
    ├── auth/    onboarding/    home/    pockets/
    ├── income/   expenses/     debts/    collections/
    ├── savings/  cadena/       reports/  history/
    └── config/
```

### 3.2 Modelo de datos

**Tablas principales** (las definiciones canónicas viven en `src/types/index.ts`):

| Tabla | Concepto |
|---|---|
| `user_profiles` | Datos del usuario (nombre, onboarding_completed, balance_hidden) |
| `platforms` | Apps de delivery (Rappi, Uber, …) con `payout_day` y `payout_pocket_id` |
| `pockets` | Bolsillos: efectivo, banco/digital, **plataforma** (`type: 'platform'`, `platform_id`) |
| `categories` | Categorías de gasto |
| `transactions` | Ingresos / gastos / transferencias atómicas con `pocket_id` |
| `debts` | Lo que YO debo (cuotas a otros) |
| `collections` | Lo que ME deben (cobros a terceros) |
| `saving_goals` | Metas de ahorro |
| `cadenas` | Juntas rotativas estilo "tanda" |
| `scheduled_events` | **El "calendario"**: un evento pendiente apunta a una entidad via `reference_id` + `type` |

### 3.3 El concepto central: `scheduled_events`

La agenda en el Home no es otra cosa que **una vista filtrada y ordenada** de
`scheduled_events` con `status: 'pending'`. Cada evento es polimórfico:

```ts
type EventType = 'debt' | 'collection' | 'saving' | 'cadena' | 'platform_payout'

interface ScheduledEvent {
  id, user_id, type, reference_id, reference_type,
  amount, due_date, status,            // 'pending' | 'confirmed' | 'partial' | 'postponed'
  actual_pocket_id, partial_amount, remaining_after_partial, created_at
}
```

Al **confirmar** un evento (`confirmEvent`), `useScheduledEvents` despacha al
handler correspondiente (`handleDebtConfirm`, `handleCollectionConfirm`, …)
que:
1. Ajusta el balance del pocket correspondiente
2. Crea una `Transaction` (record histórico)
3. Marca el evento como `confirmed`
4. Programa el siguiente evento (`scheduleNext`) si la entidad es recurrente

### 3.4 Cierre semanal de plataformas (la pieza más sutil)

Lógica en `usePlatformPayouts.ts`. La semana laboral es **lunes → domingo**.

Al cargar la app:
1. Calcular el último domingo pasado (`mostRecentSunday`)
2. Para cada plataforma activa:
   - Si `last_closed_sunday` es null → marcar baseline, NO cerrar retroactivamente
   - Si gap > 7 días → marcador obsoleto, refrescar baseline sin cerrar
   - Si `last_closed_sunday === lastSundayStr` → ya cerrado
   - Si no, **cerrar la semana**: tomar el balance del pocket → crear/actualizar
     evento `platform_payout` con `due_date` = próximo `payout_day` futuro →
     resetear el pocket a 0

### 3.5 Sincronización Dexie ↔ Supabase

`src/lib/sync.ts` configura **hooks de Dexie** que escuchan `creating`,
`updating`, `deleting` y hacen `upsert`/`delete` en Supabase **fire-and-forget**.

`pullFromSupabase` se llama al login: descarga TODO el estado del servidor y
hace `bulkPut` en Dexie. Bandera `syncing` evita el ciclo pull→hook→push→pull.

**Booleanos**: Dexie/IndexedDB no indexa `boolean`, así que los campos
booleanos indexados (`is_active`, etc.) se almacenan como `0|1`. La función
`toSupabase()` los re-convierte a `true|false` antes de subir.

---

## 4. Flujo de un usuario típico

1. **Sign-up** → `useAuth.signUp` crea usuario en Supabase Auth + `user_profiles`
2. **Onboarding** (5 pasos):
   - Step 1: Nombre
   - Step 2: ¿En qué plataformas trabajas?
   - Step 3: ¿Qué bolsillos tienes? (Nequi, Bancolombia, Efectivo, …)
   - Step 4: Saldo inicial de cada plataforma
   - Step 5: Día de pago + bolsillo destino por plataforma
3. **Home** muestra: saldo total, balance del período, billeteras de plataforma
   (con "por cobrar" y "esta semana"), agenda de hoy/semana/mes, accesos a módulos
4. Durante el día: el usuario **registra ingresos** (mezcla cash + digital por
   plataforma) y **gastos** (con categoría opcional)
5. Cada evento pendiente (cobro, deuda, etc.) aparece en la agenda; tap →
   `ConfirmEventSheet` → Cobré / Pagué / Posponer / Eliminar
6. Cuando una plataforma cierra su semana (domingo nocturno → lunes 00:00 CO),
   `usePlatformPayouts` corre en el siguiente load y crea el evento "por cobrar"
   con la fecha del próximo día de pago
7. Al cobrar el payout: `handlePlatformPayoutConfirm` mueve el monto al pocket
   destino y registra la transacción

---

## 5. Errores cometidos en la construcción (no repetir)

### 5.1 Race conditions por doble-tap

**Problema**: En React 18 con auto-batching, dos taps en el mismo handler antes
del primer re-render disparan ambos `onClick`. Los flags de loading
(`useState(saving)`) son **asíncronos** y no protegen contra esto.

**Síntomas observados**:
- Eventos duplicados creados al confirmar un cobro/deuda (cada confirmación
  llamaba `scheduleNext` que creaba el siguiente evento → dos siguientes)
- Bolsillos con balance equivocado por doble adjust

**Lección**: Para protección anti-doble-submit usar `useRef`, no `useState`.
Ver `hooks/useSubmitLock.ts`.

### 5.2 Lectura-modificación-escritura sin transacción

**Problema**: `addTransaction` hace `db.pockets.get(id)` → calcula nuevo balance
→ `db.pockets.update(...)`. Dos llamadas paralelas leen el mismo balance.

**Síntomas**: Lost-update — el balance refleja solo una de las dos transacciones.

**Lección**: Cualquier operación sobre `balance` debe ir en una **transacción
Dexie** (`db.transaction('rw', db.pockets, async () => {...})`). Lo mismo aplica
a contadores como `paid_amount`, `collected_amount`, `saved_amount`, `paid_rounds`.

### 5.3 Cierre retroactivo agresivo

**Problema**: `usePlatformPayouts` originalmente cerraba CUALQUIER semana cuyo
domingo ya pasara y no estuviera marcada como cerrada. Si `last_closed_sunday`
era null o muy viejo, tomaba el balance ACTUAL como si fuera de esa semana
pasada → fechas y montos incorrectos.

**Síntomas observados**:
- Usuario instaló app el viernes, balance $214 (de esta semana) se interpretó
  como cierre de la semana pasada → evento "por cobrar 19 May" (martes pasado)
- Reset del pocket a 0 con plata que era de esta semana

**Lección**:
- Si `last_closed_sunday` es null → marcar baseline, NO cerrar
- Si `gap > 7 días` → marcador obsoleto (datos restaurados, upgrade, ausencia
  larga) → refrescar baseline sin cerrar
- El `due_date` calculado siempre debe avanzar al próximo futuro

### 5.4 Hardcodear `platform_id: null` en `PocketForm`

**Problema**: El form de bolsillos forzaba `platform_id: null` al guardar.
Editar un pocket de plataforma desvinculaba el bolsillo de la plataforma.
Después la plataforma aparecía "sin billetera" y al agregar ingreso se creaba
una nueva.

**Lección**: En forms, **preservar** los campos no editables del `initial`.
Patrón: `platform_id: initial?.platform_id ?? null`.

### 5.5 Confiar en que el pocket ya fue reseteado al cobrar payout

**Problema**: `handlePlatformPayoutConfirm` asumía "el pocket ya está en 0,
sumo `event.amount` al destino". Falla si hay eventos fantasma o datos
restaurados → doble conteo.

**Solución actual**: Drenar el pocket hasta `min(pocket.balance, event.amount)`.
⚠️ **Aún incorrecto** en el caso de nuevas ganancias acumuladas — ver bug #B7
en el reporte.

**Lección**: No asumir invariantes implícitas entre módulos; verificar el
estado en cada operación.

### 5.6 No limpiar eventos huérfanos

**Problema**: Al eliminar un cobro, sus `scheduled_events` pendientes
quedaban en BD. Aparecían como "eventos fantasma" en la agenda apuntando a
referencias inexistentes.

**Lección**: Cada `closeX` debe borrar TODOS los `scheduled_events` con
`reference_id` matching. Además, hay limpieza pasiva en `useScheduledEvents.load`
que detecta huérfanos al cargar.

### 5.7 Auto-actualizar fechas de eventos al cambiar payout_day

**Problema vs no-problema**: Al cambiar `payout_day` de Rappi en Configuración,
los eventos pendientes seguían apuntando a la fecha vieja. Si **se actualizan**,
podemos sobrescribir intencionalidad del usuario; si **no**, las fechas quedan
desfasadas.

**Lección**: Recalcular el `due_date` de eventos pendientes cuando se cambia
`payout_day`, pero usando **hoy** como base (no `lastSunday`) para que la fecha
caiga en el próximo futuro.

### 5.8 Z-index colisionando con BottomNav

**Problema**: BottomNav y los sheets/modales tenían ambos `z-50`. La barra
inferior aparecía DESPUÉS en el DOM → tapaba ~70px del fondo de los sheets,
ocultando botones críticos como "Eliminar este pendiente".

**Lección**: Reservar `z-50` para chrome persistente (nav). Sheets/modales
usar `z-[60]+`. Además usar `max-height: 90dvh` y `overflow-y-auto` para que
nunca se salga de la pantalla.

### 5.9 PWA service worker sin `skipWaiting`/`clientsClaim`

**Problema**: Al desplegar fixes, los celulares de los usuarios seguían viendo
código viejo por días/semanas. El nuevo SW esperaba a que se cerraran TODAS
las pestañas.

**Lección**: En `vite.config.ts`, `workbox: { skipWaiting: true, clientsClaim: true,
cleanupOutdatedCaches: true }`. Los updates de código llegan en el siguiente
abrir de la app.

### 5.10 Booleanos en IndexedDB

**Problema**: IndexedDB no acepta `boolean` en columnas indexadas. Si guardas
`is_active: true`, no puedes filtrar por `where('is_active').equals(true)`.

**Solución actual**: Hook de Dexie convierte `boolean → 0|1` al crear/actualizar.
`Boolean(p.is_active)` para leer (funciona con 0/1 y true/false).

**Lección**: Documentar este detalle en cualquier nueva tabla con booleanos
indexados.

### 5.11 `parseInt` en `AmountInput`

**Problema**: `parseAmount` usa `parseInt(raw.replace(/\D/g, ''), 10)`. No
acepta decimales. Acceptable en COP (no se usan centavos), pero limitante para
otros usos.

**Lección**: Si en el futuro se hace multi-moneda, refactorizar a `parseFloat`
+ manejo de separadores localizados.

### 5.12 Cache de "today" en cierres de día

**Problema**: `const today = new Date().toISOString().slice(0,10)` se calcula
una sola vez al montar el hook. Si la app queda abierta cruzando medianoche,
`today` no se actualiza. La agenda "Hoy" mostraría datos del día anterior.

**Lección**: En vistas con dependencia fuerte de "hoy", recalcular en cada
render o usar un timer que dispare un re-render a medianoche.

---

## 6. Convenciones del proyecto

### Forms

- Estado del form con `useState` locales (no Redux/Zustand)
- Boton de submit deshabilitado con `useSubmitLock` (no `useState`)
- Preservar `initial?.<campo>` para campos no editables
- Validación inline con un boolean `canSave`

### Hooks de dominio

- Cada entidad principal tiene un hook `useX(userId)` que retorna `{data, loading,
  addX, updateX, recordX, closeX}`
- `load()` es `useCallback` con `[userId]`, llamado desde un `useEffect`
- Filtro local por status === 'active' / `is_active` antes de retornar

### Estilos

- Tailwind utility-first, sin CSS escrito
- Paleta: `slate-*` (fondos), `emerald` (income/savings/confirm), `red`
  (gastos/deudas/destructivo), `amber` (warnings/parcial), `blue` (info), `violet` (cadenas), `orange` (plataformas)
- Bordes redondeados `rounded-xl` (botones), `rounded-2xl` (cards), `rounded-3xl` (sheets)
- Sheets fixed bottom con `z-[60]`, `max-height: 90dvh`, `overflow-y-auto`

### Fechas

- Almacenamiento: ISO date string `YYYY-MM-DD` (sin hora, sin timezone)
- Cómputo: `new Date(yyyy, mm, dd)` (local) — NUNCA `new Date('YYYY-MM-DD')` que
  parsea como UTC y puede saltar de día en zonas como Colombia (UTC-5)
- `toISOString().slice(0,10)` para convertir Date local → string almacenable

---

## 7. Puntos críticos que NO se deben tocar sin entender

1. **`coerceBooleans` en `db.ts`** — sin esto, los filtros por `is_active`
   fallan silenciosamente
2. **`syncing` flag en `sync.ts`** — sin esto, pull→push→pull infinito
3. **El orden en `App.tsx`**: setupSyncHooks → pullFromSupabase → check
   onboarding → render rutas
4. **`scheduleNext` y `handleX` en `useScheduledEvents`** — la lógica de
   recurrencia depende de que `confirmEvent` llame ambos en orden correcto
5. **`mostRecentSunday` en `usePlatformPayouts`** — la base de todo el cierre
   semanal
