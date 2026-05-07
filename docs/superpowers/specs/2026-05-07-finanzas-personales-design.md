# Diseño: App de Finanzas Personales para Trabajadores de Apps

**Fecha:** 2026-05-07  
**Estado:** Aprobado — listo para implementación  
**Plataforma objetivo:** PWA móvil (Android / iOS)

---

## 1. Visión General

App de finanzas personales diseñada para trabajadores de plataformas de reparto y transporte (Rappi, Uber, DiDi, Didi Food, Yango) que manejan múltiples fuentes de ingreso, ingresos en efectivo y digital, y necesitan control total de cada peso que entra y sale.

**Usuario primario:** Trabajador independiente de apps, Colombia, celular Android/iOS.  
**Problema central:** Falta de visibilidad sobre gastos de operación reales, ingresos dispersos entre plataformas, y saldos fragmentados en efectivo + bancos + billeteras de plataformas.

---

## 2. Stack Técnico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Frontend | React + Vite | Velocidad de desarrollo, ecosistema amplio |
| UI | Tailwind CSS + shadcn/ui | Componentes móviles listos, sin diseño desde cero |
| Offline | Dexie.js (IndexedDB) | Almacenamiento local, funciona sin internet |
| Backend | Supabase (PostgreSQL + Auth) | Gratuito para empezar, sync en tiempo real |
| Hosting | Vercel | Deploy automático, HTTPS, tier gratuito |
| Distribución | PWA | Sin Play Store — instalar desde Chrome con "Agregar a pantalla de inicio" |

**Flujo de datos:** Todo se guarda en IndexedDB → al detectar conexión, sincroniza con Supabase → si cambia de celular, recupera datos con login.

---

## 3. Onboarding — Primer Uso (5 pasos)

Flujo lineal con barra de progreso. Todos los campos son editables después.

| Paso | Contenido |
|------|-----------|
| 1 | Nombre del usuario |
| 2 | Selección de plataformas activas (Rappi, Uber, DiDi, Didi Food, Yango, + Otra) |
| 3 | Bolsillos bancarios con saldo actual (efectivo, Nequi, Daviplata, banco — configurable) |
| 4 | Saldo acumulado esta semana en cada billetera de plataforma |
| 5 | Día de pago semanal de cada plataforma y cuenta destino |

Al completar paso 5 → Home configurado con datos reales desde el primer día.

---

## 4. Módulos

### 4.1 Bolsillos

Tres tipos de bolsillo, todos configurables:

- **Efectivo:** Dinero físico en mano.
- **Cuentas bancarias:** Nequi, Daviplata, banco tradicional (nombre configurable, múltiples permitidas).
- **Billeteras de plataforma:** Una por plataforma activa (Rappi, Uber, DiDi, Didi Food, Yango). Acumulan solo ingresos digitales. Se vacían en el pago semanal configurado.

---

### 4.2 Ingresos por Plataforma

#### Registro diario
El trabajador copia el total del día desde la app de la plataforma y lo registra:

1. Selecciona plataforma.
2. Ingresa el total ganado.
3. Toggle: **¿Recibiste efectivo?**
   - Si sí: ingresa monto en efectivo → elige bolsillo destino (Nequi / efectivo / banco).
   - La parte efectivo **no** se acumula en la billetera de la plataforma.
   - La parte digital (total − efectivo) **sí** se acumula en la billetera de la plataforma.

**Resultado automático:**
- `Bolsillo seleccionado += monto efectivo`
- `Billetera plataforma += (total − efectivo)`

#### Pago semanal (lunes a domingo)
Configurado por plataforma: día de la semana + cuenta destino.

El día configurado la app emite una notificación de confirmación:
- Muestra saldo acumulado en la billetera de la plataforma.
- Botones: **✓ Llegó** / **↔ Otro bolsillo** / **⏭ Posponer**.
- Al confirmar: `Billetera plataforma → $0`, `Cuenta destino += saldo`.

---

### 4.3 Gastos

#### Gastos comunes de operación
Registro rápido (monto + bolsillo) o detallado (monto + categoría + bolsillo + nota + foto de recibo).

Categorías predefinidas (editables):
- ⛽ Gasolina / recarga eléctrica
- 🔧 Mantenimiento del vehículo
- 📱 Plan de datos móviles
- 🛡️ Seguro del vehículo
- 🛣️ Peajes / Multas
- 🍔 Comida mientras trabaja
- ➕ Categoría personalizada

Cada categoría puede tener un **límite de alerta mensual** configurable.

#### Deudas y compromisos
Obligaciones de pago periódico. Dos tipos:

**Con total definido:**
- Monto total de la deuda.
- Cuota por período.
- La app calcula cuántas cuotas restan.
- Barra de progreso hacia $0.
- Al llegar a $0 → deuda marcada como saldada ✓.

**Sin total (indefinido):**
- Se repite hasta que el usuario la cierre manualmente.
- Acumula historial de lo pagado.

**Configuración:** nombre, tipo, cuota, frecuencia (diario / semanal / mensual), día de pago, bolsillo de origen.

**Ajuste de deuda ya iniciada:** Al crear, toggle "¿Ya tiene pagos hechos?" con dos opciones:
- Por cuotas pagadas (ajusta con +/−).
- Por saldo restante directo.
Las cuotas anteriores a la app quedan marcadas como "antes app" en el historial.

**Confirmación de pago:**
- **✓ Pagué** → pago completo.
- **Abono parcial** → ingresa monto pagado; la diferencia queda como saldo pendiente de esa cuota; el saldo total de la deuda se reduce en el monto abonado.
- **↔ Otro bolsillo** → el pago se deduce del bolsillo real, no del configurado; el detalle conserva la descripción original.
- **⏭ Posponer** → el evento reaparece al día siguiente en la agenda.

---

### 4.4 Cobros

Dinero que terceros le deben al usuario. Misma estructura que Deudas pero en sentido inverso.

**Tipos:** Con total definido / Sin total (indefinido).  
**Configuración adicional:** Persona deudora (nombre libre), fecha de inicio (presente o futura).  
**Frecuencias:** Único / Diario / Semanal / Mensual.

**Ajuste de cobro ya iniciado:** Igual que deudas — por cuotas cobradas o por saldo restante.

**Confirmación de cobro:**
- **✓ Cobré** → cobro completo al bolsillo configurado.
- **Abono parcial** → registra monto recibido; diferencia queda pendiente de esa cuota.
- **↔ Otro bolsillo** → el cobro llegó a una cuenta distinta a la configurada; se redirige al bolsillo real conservando el detalle del cobro (visible desde ambos lados: historial del cobro e historial del bolsillo).
- **⏭ Posponer** → reaparece al día siguiente.

**Estados de cobro en lista:**
- 🟢 En curso (con barra de progreso si tiene total).
- ⚪ Indefinido (sin fecha fin).
- 🟡 Futuro (aún no ha iniciado).
- 🔔 Vence hoy.

---

### 4.5 Ahorros

Metas de ahorro con aporte programado deducible de cualquier bolsillo.

**Configuración por meta:**
- Nombre (ej: "Fondo emergencia", "Mantenimiento moto").
- Meta de monto → opcional. Sin meta = ahorro libre.
- Aporte: monto fijo o porcentaje del ingreso del período.
- Frecuencia: semanal / mensual / "al cobrar" (se deduce el mismo día del pago semanal de plataforma).
- Día del período.
- Bolsillo de origen.

**Seguimiento:** Barra de progreso hacia la meta. Total ahorrado siempre visible.

**Confirmación de ahorro:**
- **✓ Guardé** / **↔ Otro bolsillo** / **⏭ Posponer**.

---

### 4.6 Cadena / Cooperativa

Ahorro rotativo grupal (ROSCA / natillera).

**Configuración:**
- Nombre de la cadena.
- Número de participantes (ajustable con +/−).
- Aporte por persona por período → el bote total se calcula automáticamente.
- Frecuencia: semanal / mensual.
- Número del turno propio (qué posición tiene el usuario en la ronda).
- Bolsillo de pago y bolsillo de cobro.

**Ajuste de cadena ya iniciada:** Toggle "¿Ya inició?"
- Semana/mes actual en que van.
- Cuántos pagos ya hizo el usuario.
- La app calcula el balance de arranque y marca las rondas anteriores como "antes app".

**Lógica del balance:**
- **Antes de cobrar:** balance negativo = pagos hechos − bote total (lo que "debe" antes de recibir).
- **Al cobrar:** `+bote total` a la cuenta configurada; el balance refleja las cuotas pendientes hasta terminar la cadena.
- **Al terminar:** balance = $0, cadena marcada como cerrada ✓.

**Timeline visual:** Barra de 10 (o N) segmentos mostrando turnos pasados, turno actual, turno propio y turnos futuros.

**Confirmación de cuota:**
- **✓ Pagué** / **↔ Otro bolsillo** / **⏭ Posponer**.

---

### 4.7 Home / Dashboard

#### Sección de saldo
- Saldo total (suma de todos los bolsillos).
- Desglose: Ingresos / Gastos / Ahorros del período.
- Listado de bolsillos con saldo individual.
- **Ícono 👁️ arriba derecha:** oculta/muestra saldo total y todos los bolsillos con `••••••`.

#### Agenda / Calendario
Filtro: **Hoy / Esta semana / Este mes / 📅 Fecha específica**.

Cada evento en la agenda muestra:
- Tipo (color por módulo: 🟢 cobro, 🔴 deuda, 🟣 ahorro, 🔵 cadena, 🟠 plataforma).
- Descripción, monto y persona si aplica.
- Botón **Confirmar** si vence hoy.

Vista semanal: mini-calendario con puntos de colores por día + lista agrupada por fecha. Días pasados confirmados aparecen en gris.

---

## 5. Flujo de Confirmación Universal

Patrón consistente en todos los módulos para cualquier evento programado:

```
┌─────────────────────────────────────────────┐
│ [Tipo + ícono] Descripción · Monto · Fecha  │
│                                             │
│  [ ✓ Confirmar ]  [ ↔ Otro bolsillo ]  [ ⏭ ] │
└─────────────────────────────────────────────┘
```

- **✓ Confirmar:** registra el movimiento al bolsillo configurado.
- **↔ Otro bolsillo:** selecciona el bolsillo real; el detalle del evento original se conserva y es visible desde ambos lados (evento + bolsillo).
- **⏭ Posponer:** marca como pendiente; reaparece en la agenda del día siguiente.
- **Abono parcial** (en deudas y cobros): ingresa monto parcial; el saldo restante de la cuota queda pendiente en el historial.

---

## 6. Alertas

- Gasto en categoría supera límite mensual definido.
- Saldo de bolsillo de plataforma cae por debajo de mínimo configurable.
- Evento programado vence hoy (notificación push).
- Saldo insuficiente en bolsillo al intentar ejecutar ahorro programado.

---

## 7. Modelo de Datos (Entidades Principales)

| Entidad | Campos clave |
|---------|-------------|
| `user` | id, name, created_at |
| `pocket` | id, user_id, name, type (cash/bank/platform), platform_id?, balance, is_visible |
| `platform` | id, user_id, name, color, payout_day, payout_pocket_id |
| `transaction` | id, user_id, type (income/expense/transfer), amount, pocket_id, category_id?, platform_id?, reference_id?, reference_type?, note, receipt_url?, date, created_at |
| `category` | id, user_id, name, icon, monthly_limit? |
| `debt` | id, user_id, name, has_total, total_amount?, installment_amount, frequency, payment_day, source_pocket_id, paid_amount, status, started_before_app, start_installment |
| `collection` | id, user_id, name, person_name, has_total, total_amount?, installment_amount, frequency, payment_day, dest_pocket_id, collected_amount, status, start_date, started_before_app, start_installment |
| `saving_goal` | id, user_id, name, target_amount?, contribution_amount, contribution_type (fixed/percent), frequency, trigger_day, source_pocket_id, saved_amount |
| `cadena` | id, user_id, name, participants, contribution_amount, frequency, my_turn, payout_pocket_id, source_pocket_id, current_round, paid_rounds, started_before_app |
| `scheduled_event` | id, user_id, type (debt/collection/saving/cadena/platform_payout), reference_id, reference_type, amount, due_date, status (pending/confirmed/postponed/partial), actual_pocket_id?, partial_amount?, remaining_after_partial? |

---

## 8. Navegación Principal (Bottom Tab Bar)

```
🏠 Inicio  |  💳 Bolsillos  |  ＋ Registrar  |  📋 Historial  |  📊 Reportes
```

El botón central **＋** abre el registro rápido/detallado de movimiento.

---

## 9. Pantallas Identificadas

1. Onboarding (5 pasos)
2. Home / Dashboard
3. Bolsillos (lista + detalle por bolsillo)
4. Registrar movimiento (modo rápido + modo detallado)
5. Historial (filtros: hoy / semana / mes / por bolsillo / por categoría)
6. Ingresos por plataforma (registro diario + detalle semanal)
7. Gastos (lista + crear/editar gasto recurrente)
8. Deudas (lista + crear/editar + detalle + confirmación)
9. Cobros (lista + crear/editar + detalle + confirmación)
10. Ahorros (lista metas + crear/editar meta)
11. Cadena (lista + crear/editar + detalle + timeline)
12. Reportes (ganancia neta, ingresos por plataforma, gastos por categoría)
13. Configuración (perfil, plataformas, días de pago, alertas)

---

## 10. Decisiones de Diseño

- **Offline-first:** Toda escritura va primero a IndexedDB; la sync con Supabase ocurre en background cuando hay red.
- **Confirmación explícita:** Ningún evento programado se registra automáticamente sin que el usuario lo confirme. Siempre hay opción de cambiar bolsillo o posponer.
- **Ajuste retroactivo universal:** Deudas, cobros y cadenas permiten arrancar desde un punto ya avanzado con el campo "antes app" para no perder el historial real.
- **Privacidad visual:** Un toque en 👁️ oculta todos los montos en la pantalla principal, útil cuando hay personas cerca.
- **Sin funciones sociales:** Cada usuario tiene su propia instancia independiente. No hay compartir datos entre usuarios.
- **Distribución sin Play Store:** PWA instalable desde Chrome, lo que permite actualizaciones instantáneas sin pasar por revisión de tiendas.
