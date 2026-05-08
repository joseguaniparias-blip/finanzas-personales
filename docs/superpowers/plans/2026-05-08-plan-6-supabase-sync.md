# Plan 6 — Supabase Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync todos los datos locales (Dexie/IndexedDB) con Supabase para que el usuario nunca pierda datos al cambiar de celular, y cada escritura quede automáticamente respaldada en la nube.

**Architecture:** Cada escritura en Dexie dispara un push a Supabase vía Dexie hooks (fire-and-forget). Al hacer login, la app hace un pull completo de Supabase a Dexie para restaurar el estado en un dispositivo nuevo. Un flag `syncing` previene el loop circular (pull → hook → push → loop). Los campos booleanos que Dexie almacena como 0/1 se normalizan a true/false antes de enviar a Supabase.

**Tech Stack:** Supabase (PostgreSQL + RLS), Dexie.js hooks, `@supabase/supabase-js` (ya instalado)

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `supabase/migration-plan6.sql` | Crear | SQL para las 9 tablas de entidades con RLS |
| `src/lib/sync.ts` | Crear | `setupSyncHooks()` + `pullFromSupabase()` |
| `src/App.tsx` | Modificar | Llamar sync hooks al iniciar y pull al login |

---

## Task 1: SQL Migration — Crear tablas en Supabase

**Files:**
- Create: `supabase/migration-plan6.sql`

- [ ] Crear el archivo `supabase/migration-plan6.sql` con el siguiente contenido:

```sql
-- Plan 6: Supabase entity tables + RLS
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run

-- platforms
create table if not exists platforms (
  id               uuid primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  color            text not null default '',
  payout_day       int,
  payout_pocket_id uuid,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
alter table platforms enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'platforms' and policyname = 'users own platforms'
  ) then
    create policy "users own platforms" on platforms for all using (auth.uid() = user_id);
  end if;
end $$;

-- pockets
create table if not exists pockets (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null,
  platform_id uuid,
  balance     numeric not null default 0,
  color       text not null default '',
  icon        text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table pockets enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'pockets' and policyname = 'users own pockets'
  ) then
    create policy "users own pockets" on pockets for all using (auth.uid() = user_id);
  end if;
end $$;

-- categories
create table if not exists categories (
  id            uuid primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  icon          text not null default '',
  monthly_limit numeric,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table categories enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'categories' and policyname = 'users own categories'
  ) then
    create policy "users own categories" on categories for all using (auth.uid() = user_id);
  end if;
end $$;

-- transactions
create table if not exists transactions (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null,
  amount         numeric not null,
  pocket_id      uuid not null,
  category_id    uuid,
  platform_id    uuid,
  reference_id   uuid,
  reference_type text,
  note           text,
  receipt_url    text,
  date           date not null,
  created_at     timestamptz not null default now()
);
alter table transactions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'transactions' and policyname = 'users own transactions'
  ) then
    create policy "users own transactions" on transactions for all using (auth.uid() = user_id);
  end if;
end $$;

-- debts
create table if not exists debts (
  id                 uuid primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  has_total          boolean not null default false,
  total_amount       numeric,
  installment_amount numeric not null,
  frequency          text not null,
  payment_day        int not null,
  source_pocket_id   uuid not null,
  paid_amount        numeric not null default 0,
  status             text not null default 'active',
  started_before_app boolean not null default false,
  start_installment  int not null default 0,
  created_at         timestamptz not null default now()
);
alter table debts enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'debts' and policyname = 'users own debts'
  ) then
    create policy "users own debts" on debts for all using (auth.uid() = user_id);
  end if;
end $$;

-- collections
create table if not exists collections (
  id                 uuid primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  person_name        text not null,
  has_total          boolean not null default false,
  total_amount       numeric,
  installment_amount numeric not null,
  frequency          text not null,
  payment_day        int,
  dest_pocket_id     uuid not null,
  collected_amount   numeric not null default 0,
  status             text not null default 'active',
  start_date         date not null,
  started_before_app boolean not null default false,
  start_installment  int not null default 0,
  created_at         timestamptz not null default now()
);
alter table collections enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'collections' and policyname = 'users own collections'
  ) then
    create policy "users own collections" on collections for all using (auth.uid() = user_id);
  end if;
end $$;

-- saving_goals
create table if not exists saving_goals (
  id                  uuid primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  target_amount       numeric,
  contribution_amount numeric not null,
  contribution_type   text not null,
  frequency           text not null,
  trigger_day         int,
  source_pocket_id    uuid not null,
  saved_amount        numeric not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
alter table saving_goals enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'saving_goals' and policyname = 'users own saving_goals'
  ) then
    create policy "users own saving_goals" on saving_goals for all using (auth.uid() = user_id);
  end if;
end $$;

-- cadenas
create table if not exists cadenas (
  id                  uuid primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  participants        int not null,
  contribution_amount numeric not null,
  frequency           text not null,
  my_turn             int not null,
  payout_pocket_id    uuid not null,
  source_pocket_id    uuid not null,
  current_round       int not null default 1,
  paid_rounds         int not null default 0,
  started_before_app  boolean not null default false,
  status              text not null default 'active',
  created_at          timestamptz not null default now()
);
alter table cadenas enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'cadenas' and policyname = 'users own cadenas'
  ) then
    create policy "users own cadenas" on cadenas for all using (auth.uid() = user_id);
  end if;
end $$;

-- scheduled_events
create table if not exists scheduled_events (
  id                      uuid primary key,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  type                    text not null,
  reference_id            uuid not null,
  reference_type          text not null,
  amount                  numeric not null,
  due_date                date not null,
  status                  text not null default 'pending',
  actual_pocket_id        uuid,
  partial_amount          numeric,
  remaining_after_partial numeric,
  created_at              timestamptz not null default now()
);
alter table scheduled_events enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'scheduled_events' and policyname = 'users own scheduled_events'
  ) then
    create policy "users own scheduled_events" on scheduled_events for all using (auth.uid() = user_id);
  end if;
end $$;
```

- [ ] Ir al Supabase Dashboard → SQL Editor → New query → pegar el SQL → Run
  - Resultado esperado: "Success. No rows returned" para cada tabla
  - Si alguna tabla ya existe, la cláusula `IF NOT EXISTS` la omite sin error

---

## Task 2: Crear `src/lib/sync.ts`

**Files:**
- Create: `src/lib/sync.ts`

- [ ] Crear `src/lib/sync.ts`:

```typescript
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

// Prevents circular sync: pull → hook → push → loop
let syncing = false
let hooksSetup = false

// Dexie stores these booleans as 0/1 due to IndexedDB index limitations.
// Supabase expects actual booleans.
const BOOL_FIELDS: Record<string, string[]> = {
  user_profiles: ['onboarding_completed', 'balance_hidden'],
  platforms:     ['is_active'],
  pockets:       ['is_active'],
  categories:    ['is_default'],
  debts:         ['has_total', 'started_before_app'],
  collections:   ['has_total', 'started_before_app'],
  saving_goals:  ['is_active'],
  cadenas:       ['started_before_app'],
}

function toSupabase(table: string, record: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...record }
  for (const field of BOOL_FIELDS[table] ?? []) {
    if (field in copy) copy[field] = Boolean(copy[field])
  }
  return copy
}

function pushRecord(table: string, record: Record<string, unknown>) {
  if (syncing) return
  supabase.from(table).upsert(toSupabase(table, record)).then(({ error }) => {
    if (error) console.warn(`[sync] push error on ${table}:`, error.message)
  })
}

function deleteRecord(table: string, id: string) {
  if (syncing) return
  supabase.from(table).delete().eq('id', id).then(({ error }) => {
    if (error) console.warn(`[sync] delete error on ${table}:`, error.message)
  })
}

export function setupSyncHooks() {
  if (hooksSetup) return
  hooksSetup = true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables: [string, any][] = [
    ['platforms',        db.platforms],
    ['pockets',          db.pockets],
    ['categories',       db.categories],
    ['transactions',     db.transactions],
    ['debts',            db.debts],
    ['collections',      db.collections],
    ['saving_goals',     db.saving_goals],
    ['cadenas',          db.cadenas],
    ['scheduled_events', db.scheduled_events],
    ['user_profiles',    db.user_profiles],
  ]

  for (const [tableName, table] of tables) {
    table.hook('creating', (_key: unknown, obj: Record<string, unknown>) => {
      pushRecord(tableName, obj)
    })
    table.hook('updating', (mods: Record<string, unknown>, _key: unknown, obj: Record<string, unknown>) => {
      pushRecord(tableName, { ...obj, ...mods })
    })
    table.hook('deleting', (key: string) => {
      deleteRecord(tableName, key)
    })
  }
}

export async function pullFromSupabase(userId: string) {
  syncing = true
  try {
    const [
      { data: platforms },
      { data: pockets },
      { data: categories },
      { data: transactions },
      { data: debts },
      { data: collections },
      { data: saving_goals },
      { data: cadenas },
      { data: scheduled_events },
      { data: user_profiles },
    ] = await Promise.all([
      supabase.from('platforms').select('*').eq('user_id', userId),
      supabase.from('pockets').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('debts').select('*').eq('user_id', userId),
      supabase.from('collections').select('*').eq('user_id', userId),
      supabase.from('saving_goals').select('*').eq('user_id', userId),
      supabase.from('cadenas').select('*').eq('user_id', userId),
      supabase.from('scheduled_events').select('*').eq('user_id', userId),
      supabase.from('user_profiles').select('*').eq('id', userId),
    ])

    await db.transaction('rw', [
      db.platforms, db.pockets, db.categories, db.transactions,
      db.debts, db.collections, db.saving_goals, db.cadenas,
      db.scheduled_events, db.user_profiles,
    ], async () => {
      if (platforms?.length)        await db.platforms.bulkPut(platforms)
      if (pockets?.length)          await db.pockets.bulkPut(pockets)
      if (categories?.length)       await db.categories.bulkPut(categories)
      if (transactions?.length)     await db.transactions.bulkPut(transactions)
      if (debts?.length)            await db.debts.bulkPut(debts)
      if (collections?.length)      await db.collections.bulkPut(collections)
      if (saving_goals?.length)     await db.saving_goals.bulkPut(saving_goals)
      if (cadenas?.length)          await db.cadenas.bulkPut(cadenas)
      if (scheduled_events?.length) await db.scheduled_events.bulkPut(scheduled_events)
      if (user_profiles?.length)    await db.user_profiles.bulkPut(user_profiles)
    })
  } catch (e) {
    console.warn('[sync] pull failed:', e)
  } finally {
    syncing = false
  }
}
```

---

## Task 3: Wiring App.tsx

**Files:**
- Modify: `src/App.tsx`

El estado actual de `App.tsx`:
- Ya hace `checkOnboarding()` en el `useEffect` cuando `user` cambia
- Ya tiene un fallback que lee `user_profiles` de Supabase cuando no hay datos locales
- **Falta**: llamar `setupSyncHooks()` al arrancar y `pullFromSupabase()` al hacer login

- [ ] Agregar imports al inicio de `src/App.tsx` (después de los imports existentes):

```typescript
import { setupSyncHooks, pullFromSupabase } from '@/lib/sync'
```

- [ ] Agregar dentro de `AppRoutes()`, justo después de la línea `usePlatformPayouts(...)`:

```typescript
  // Set up Dexie → Supabase push hooks once (global to the DB instance)
  useEffect(() => {
    setupSyncHooks()
  }, [])

  // Pull all cloud data into local DB when user logs in
  useEffect(() => {
    if (user) pullFromSupabase(user.id)
  }, [user?.id])
```

El `checkOnboarding` existente sigue igual — el `pullFromSupabase` corre en paralelo y es fire-and-forget (no bloquea el flujo de onboarding).

---

## Task 4: PWA Icons

**Files:**
- Modify: `public/icons/icon-192.png`
- Modify: `public/icons/icon-512.png`

Los archivos actuales en `public/icons/` miden 70 bytes — son placeholders inválidos. El manifest del PWA los referencia, por lo que la instalación de la app falla en mobile.

- [ ] Instalar `@vite-pwa/assets-generator` como dev dependency:

```bash
npm install -D @vite-pwa/assets-generator
```

- [ ] Agregar script en `package.json` dentro de `"scripts"`:

```json
"generate-icons": "pwa-assets-generator --preset minimal public/favicon.svg"
```

- [ ] Ejecutar el generador:

```bash
npm run generate-icons
```

Esto lee `public/favicon.svg` y genera:
- `public/icons/icon-192.png` (192×192, PNG real)
- `public/icons/icon-512.png` (512×512, PNG real)

- [ ] Verificar tamaños: ambos archivos deben ser > 1 KB

```bash
ls -la public/icons/
```

Resultado esperado: `icon-192.png` ~5–15 KB, `icon-512.png` ~20–60 KB

- [ ] Si el generador no funciona con la ruta, ejecutar pasando la ruta absoluta del SVG:

```bash
npx pwa-assets-generator --preset minimal-2023 public/favicon.svg
```

---

## Task 5: Verify + Commit

- [ ] Verificar que no hay errores de TypeScript:

```bash
npm run build
```

Resultado esperado: build exitoso sin errores. Si hay error en `sync.ts` por el `any` del hook:
```
Property 'hook' does not exist on type...
```
Es seguro ignorarlo con el `eslint-disable` ya incluido — Dexie hooks son dynamically typed.

- [ ] Arrancar el dev server y verificar en consola del browser que no hay errores:

```bash
npm run dev
```

Abrir DevTools → Console → no debe haber errores de sync en la carga inicial (puede haber warnings de "pull failed" si Supabase aún no tiene las tablas).

- [ ] Ejecutar la migración SQL en Supabase (Task 1) si aún no se hizo.

- [ ] Commit:

```bash
git add src/lib/sync.ts src/App.tsx supabase/migration-plan6.sql public/icons/ package.json
git commit -m "feat: Plan 6 — Supabase sync + PWA icons reales"
```

---

## Self-Review

### Spec coverage

| Req del spec | Tarea |
|---|---|
| "Todo se guarda en IndexedDB → al detectar conexión, sincroniza con Supabase" | Task 2 — hooks push on every write |
| "Si cambia de celular, recupera datos con login" | Task 3 — pull on user?.id change |
| "Distribución PWA, sin Play Store" | Task 4 — íconos reales para instalación |

### Gaps identificados

- **Conflict resolution**: no implementado — Supabase gana en pull, local gana durante la sesión. Aceptable para v1.
- **Offline queue**: si el push falla por falta de red, no se reintentan las escrituras perdidas. El pull al siguiente login las recupera desde Supabase (que ya tenía el estado anterior). Pérdida máxima: los cambios hechos offline entre el último pull y el siguiente login. Aceptable para v1.
- **`user_profiles` table en Supabase**: ya existía (creada en `signUp`). La migración la omite con `IF NOT EXISTS`.
