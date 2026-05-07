# Plan 1 — Foundation: Setup, Auth, Onboarding, Bolsillos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the PWA, configure Supabase + offline storage, build authentication, 5-step onboarding, and the Bolsillos (pockets) module — producing a working installable app where users can register, set up their accounts, and view their balances.

**Architecture:** React + Vite PWA with Tailwind + shadcn/ui. Dexie.js stores all data locally first; a background sync layer pushes changes to Supabase. Supabase Auth handles login/register with email. React Router v6 handles navigation with a bottom tab bar shell.

**Tech Stack:** React 18, TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui, Dexie.js 4, Supabase JS 2, React Router 6, vite-plugin-pwa, Vitest, React Testing Library

---

## File Map

```
finanzas-personales/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png          (placeholder — replace with real icon)
│       └── icon-512.png          (placeholder — replace with real icon)
├── src/
│   ├── main.tsx                  Entry point
│   ├── App.tsx                   Router + auth gate
│   ├── types/
│   │   └── index.ts              All shared TypeScript types
│   ├── lib/
│   │   ├── supabase.ts           Supabase client singleton
│   │   ├── db.ts                 Dexie database schema + instance
│   │   └── sync.ts               Offline → Supabase sync utilities
│   ├── hooks/
│   │   ├── useAuth.ts            Auth state hook
│   │   └── usePockets.ts         Pockets CRUD hook
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      Wraps pages with BottomNav
│   │   │   └── BottomNav.tsx     5-tab bottom navigation
│   │   └── shared/
│   │       └── PrivacyToggle.tsx  Eye icon toggle component
│   ├── pages/
│   │   ├── auth/
│   │   │   └── AuthPage.tsx      Login + Register forms
│   │   ├── onboarding/
│   │   │   ├── OnboardingFlow.tsx Orchestrates 5 steps
│   │   │   ├── Step1Name.tsx
│   │   │   ├── Step2Platforms.tsx
│   │   │   ├── Step3Pockets.tsx
│   │   │   ├── Step4PlatformBalances.tsx
│   │   │   └── Step5PayoutDays.tsx
│   │   ├── home/
│   │   │   └── HomePage.tsx      Placeholder (built in Plan 5)
│   │   ├── pockets/
│   │   │   ├── PocketsPage.tsx   List of pockets with totals
│   │   │   ├── PocketForm.tsx    Add / edit pocket form
│   │   │   └── PocketCard.tsx    Single pocket display card
│   │   ├── register/
│   │   │   └── RegisterPage.tsx  Placeholder
│   │   ├── history/
│   │   │   └── HistoryPage.tsx   Placeholder
│   │   └── reports/
│   │       └── ReportsPage.tsx   Placeholder
│   └── supabase/
│       └── migrations/
│           └── 001_initial_schema.sql
├── src/test/
│   ├── setup.ts
│   ├── lib/
│   │   └── db.test.ts
│   ├── hooks/
│   │   ├── useAuth.test.ts
│   │   └── usePockets.test.ts
│   └── pages/
│       ├── onboarding/
│       │   └── OnboardingFlow.test.tsx
│       └── pockets/
│           └── PocketsPage.test.tsx
```

---

## Task 1: Scaffold Project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `index.html`, `.env.example`

- [ ] **Step 1.1 — Create the project**

```bash
cd "/c/Users/Usuario/Desktop/CLAUDE CODE/finanzas-personales"
npm create vite@latest . -- --template react-ts
```

Accept overwrite prompt with `y`. Expected output: files created in current directory.

- [ ] **Step 1.2 — Install all dependencies**

```bash
npm install
npm install @supabase/supabase-js dexie react-router-dom
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install -D vite-plugin-pwa workbox-window
npm install tailwindcss @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 1.3 — Configure Vite**

Replace `vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mis Finanzas',
        short_name: 'Finanzas',
        description: 'Control financiero para trabajadores de apps',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false
  }
})
```

- [ ] **Step 1.4 — Configure Tailwind**

Replace `tailwind.config.ts` with:

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          income: '#34d399',
          expense: '#f87171',
          saving: '#a78bfa',
          cadena: '#38bdf8',
          platform: '#fb923c',
          debt: '#f87171',
          collection: '#34d399',
        }
      }
    }
  },
  plugins: []
} satisfies Config
```

- [ ] **Step 1.5 — Configure TypeScript**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 1.6 — Create .env.example**

```bash
cat > .env.example << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF
cp .env.example .env.local
```

- [ ] **Step 1.7 — Create test setup**

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 1.8 — Replace index.html**

```html
<!doctype html>
<html lang="es" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icons/icon-192.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Mis Finanzas</title>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 1.9 — Create placeholder icons**

```bash
mkdir -p public/icons
# Create 1px placeholder PNGs (replace with real icons later)
node -e "
const fs = require('fs');
// Minimal valid 1x1 PNG in base64
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('public/icons/icon-192.png', png);
fs.writeFileSync('public/icons/icon-512.png', png);
"
```

- [ ] **Step 1.10 — Verify project runs**

```bash
npm run dev
```

Expected: Vite dev server starts on `http://localhost:5173`. Browser shows default React page.

- [ ] **Step 1.11 — Commit**

```bash
git add -A
git commit -m "feat: scaffold PWA project with Vite, React, Tailwind, Supabase, Dexie"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 2.1 — Write all shared types**

Create `src/types/index.ts`:

```typescript
// ─── Enums ───────────────────────────────────────────────────────────────────

export type PocketType = 'cash' | 'bank' | 'platform'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type Frequency = 'daily' | 'weekly' | 'monthly'
export type CollectionFrequency = 'once' | 'daily' | 'weekly' | 'monthly'
export type ContributionType = 'fixed' | 'percent'
export type SavingFrequency = 'weekly' | 'monthly' | 'on_payout'
export type EventStatus = 'pending' | 'confirmed' | 'postponed' | 'partial'
export type EventType = 'debt' | 'collection' | 'saving' | 'cadena' | 'platform_payout'
export type DebtStatus = 'active' | 'paid_off' | 'cancelled'
export type CollectionStatus = 'active' | 'fully_collected' | 'cancelled'
export type CadenaStatus = 'active' | 'completed'

// ─── Core entities ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  name: string
  onboarding_completed: boolean
  balance_hidden: boolean
  created_at: string
}

export interface Platform {
  id: string
  user_id: string
  name: string
  color: string
  payout_day: number | null   // 0=Sun, 1=Mon … 6=Sat
  payout_pocket_id: string | null
  is_active: boolean
  created_at: string
}

export interface Pocket {
  id: string
  user_id: string
  name: string
  type: PocketType
  platform_id: string | null
  balance: number
  color: string
  icon: string
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  monthly_limit: number | null
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  pocket_id: string
  category_id: string | null
  platform_id: string | null
  reference_id: string | null
  reference_type: string | null
  note: string | null
  receipt_url: string | null
  date: string              // YYYY-MM-DD
  created_at: string
}

export interface Debt {
  id: string
  user_id: string
  name: string
  has_total: boolean
  total_amount: number | null
  installment_amount: number
  frequency: Frequency
  payment_day: number
  source_pocket_id: string
  paid_amount: number
  status: DebtStatus
  started_before_app: boolean
  start_installment: number
  created_at: string
}

export interface Collection {
  id: string
  user_id: string
  name: string
  person_name: string
  has_total: boolean
  total_amount: number | null
  installment_amount: number
  frequency: CollectionFrequency
  payment_day: number | null
  dest_pocket_id: string
  collected_amount: number
  status: CollectionStatus
  start_date: string
  started_before_app: boolean
  start_installment: number
  created_at: string
}

export interface SavingGoal {
  id: string
  user_id: string
  name: string
  target_amount: number | null
  contribution_amount: number
  contribution_type: ContributionType
  frequency: SavingFrequency
  trigger_day: number | null
  source_pocket_id: string
  saved_amount: number
  is_active: boolean
  created_at: string
}

export interface Cadena {
  id: string
  user_id: string
  name: string
  participants: number
  contribution_amount: number
  frequency: 'weekly' | 'monthly'
  my_turn: number
  payout_pocket_id: string
  source_pocket_id: string
  current_round: number
  paid_rounds: number
  started_before_app: boolean
  status: CadenaStatus
  created_at: string
}

export interface ScheduledEvent {
  id: string
  user_id: string
  type: EventType
  reference_id: string
  reference_type: string
  amount: number
  due_date: string          // YYYY-MM-DD
  status: EventStatus
  actual_pocket_id: string | null
  partial_amount: number | null
  remaining_after_partial: number | null
  created_at: string
}

// ─── Form / UI helpers ────────────────────────────────────────────────────────

export interface OnboardingData {
  name: string
  platforms: string[]             // selected platform names
  pockets: PocketDraft[]
  platformBalances: Record<string, number>   // platformName → balance
  payoutConfig: Record<string, PayoutConfig> // platformName → config
}

export interface PocketDraft {
  name: string
  type: PocketType
  balance: number
  color: string
  icon: string
}

export interface PayoutConfig {
  day: number          // 0-6 day of week
  pocket_id: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORM_DEFAULTS: Record<string, { color: string; icon: string }> = {
  Rappi:     { color: '#fb923c', icon: '🛵' },
  Uber:      { color: '#60a5fa', icon: '🚗' },
  DiDi:      { color: '#4ade80', icon: '🚘' },
  'DiDi Food': { color: '#86efac', icon: '🍔' },
  Yango:     { color: '#f472b6', icon: '🚖' },
}

export const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const DEFAULT_CATEGORIES = [
  { name: 'Gasolina',      icon: '⛽' },
  { name: 'Mantenimiento', icon: '🔧' },
  { name: 'Datos móviles', icon: '📱' },
  { name: 'Seguro',        icon: '🛡️' },
  { name: 'Peajes/Multas', icon: '🛣️' },
  { name: 'Comida',        icon: '🍔' },
]
```

- [ ] **Step 2.2 — Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types for all entities"
```

---

## Task 3: Supabase + Database Schema

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/supabase/migrations/001_initial_schema.sql`

- [ ] **Step 3.1 — Create Supabase client**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3.2 — Create database migration**

Create `src/supabase/migrations/001_initial_schema.sql`:

```sql
-- Run this in the Supabase SQL Editor
-- https://app.supabase.com → your project → SQL Editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── User profiles ───────────────────────────────────────────────────────────
create table user_profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  onboarding_completed boolean not null default false,
  balance_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table user_profiles enable row level security;
create policy "Users manage own profile"
  on user_profiles for all using (auth.uid() = id);

-- ─── Platforms ───────────────────────────────────────────────────────────────
create table platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#94a3b8',
  payout_day integer,
  payout_pocket_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table platforms enable row level security;
create policy "Users manage own platforms"
  on platforms for all using (auth.uid() = user_id);

-- ─── Pockets ─────────────────────────────────────────────────────────────────
create table pockets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','platform')),
  platform_id uuid references platforms on delete set null,
  balance numeric(12,2) not null default 0,
  color text not null default '#334155',
  icon text not null default '💳',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table pockets enable row level security;
create policy "Users manage own pockets"
  on pockets for all using (auth.uid() = user_id);

-- Add FK back to platforms now that pockets table exists
alter table platforms
  add constraint platforms_payout_pocket_id_fkey
  foreign key (payout_pocket_id) references pockets on delete set null;

-- ─── Categories ──────────────────────────────────────────────────────────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  icon text not null,
  monthly_limit numeric(12,2),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table categories enable row level security;
create policy "Users manage own categories"
  on categories for all using (auth.uid() = user_id);

-- ─── Transactions ─────────────────────────────────────────────────────────────
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(12,2) not null,
  pocket_id uuid not null references pockets on delete restrict,
  category_id uuid references categories on delete set null,
  platform_id uuid references platforms on delete set null,
  reference_id uuid,
  reference_type text,
  note text,
  receipt_url text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table transactions enable row level security;
create policy "Users manage own transactions"
  on transactions for all using (auth.uid() = user_id);

-- ─── Debts ───────────────────────────────────────────────────────────────────
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  has_total boolean not null default false,
  total_amount numeric(12,2),
  installment_amount numeric(12,2) not null,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  payment_day integer not null,
  source_pocket_id uuid not null references pockets on delete restrict,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('active','paid_off','cancelled')),
  started_before_app boolean not null default false,
  start_installment integer not null default 1,
  created_at timestamptz not null default now()
);
alter table debts enable row level security;
create policy "Users manage own debts"
  on debts for all using (auth.uid() = user_id);

-- ─── Collections ─────────────────────────────────────────────────────────────
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  person_name text not null,
  has_total boolean not null default false,
  total_amount numeric(12,2),
  installment_amount numeric(12,2) not null,
  frequency text not null check (frequency in ('once','daily','weekly','monthly')),
  payment_day integer,
  dest_pocket_id uuid not null references pockets on delete restrict,
  collected_amount numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('active','fully_collected','cancelled')),
  start_date date not null default current_date,
  started_before_app boolean not null default false,
  start_installment integer not null default 1,
  created_at timestamptz not null default now()
);
alter table collections enable row level security;
create policy "Users manage own collections"
  on collections for all using (auth.uid() = user_id);

-- ─── Saving goals ────────────────────────────────────────────────────────────
create table saving_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  target_amount numeric(12,2),
  contribution_amount numeric(12,2) not null,
  contribution_type text not null check (contribution_type in ('fixed','percent')),
  frequency text not null check (frequency in ('weekly','monthly','on_payout')),
  trigger_day integer,
  source_pocket_id uuid not null references pockets on delete restrict,
  saved_amount numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table saving_goals enable row level security;
create policy "Users manage own saving_goals"
  on saving_goals for all using (auth.uid() = user_id);

-- ─── Cadenas ─────────────────────────────────────────────────────────────────
create table cadenas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  participants integer not null check (participants >= 2),
  contribution_amount numeric(12,2) not null,
  frequency text not null check (frequency in ('weekly','monthly')),
  my_turn integer not null,
  payout_pocket_id uuid not null references pockets on delete restrict,
  source_pocket_id uuid not null references pockets on delete restrict,
  current_round integer not null default 1,
  paid_rounds integer not null default 0,
  started_before_app boolean not null default false,
  status text not null default 'active' check (status in ('active','completed')),
  created_at timestamptz not null default now()
);
alter table cadenas enable row level security;
create policy "Users manage own cadenas"
  on cadenas for all using (auth.uid() = user_id);

-- ─── Scheduled events ────────────────────────────────────────────────────────
create table scheduled_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('debt','collection','saving','cadena','platform_payout')),
  reference_id uuid not null,
  reference_type text not null,
  amount numeric(12,2) not null,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','postponed','partial')),
  actual_pocket_id uuid references pockets on delete set null,
  partial_amount numeric(12,2),
  remaining_after_partial numeric(12,2),
  created_at timestamptz not null default now()
);
alter table scheduled_events enable row level security;
create policy "Users manage own scheduled_events"
  on scheduled_events for all using (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index on transactions (user_id, date desc);
create index on scheduled_events (user_id, due_date);
create index on pockets (user_id, type);
```

- [ ] **Step 3.3 — Run the migration**

1. Go to https://app.supabase.com → your project → SQL Editor
2. Paste the contents of `src/supabase/migrations/001_initial_schema.sql`
3. Click Run
4. Expected: "Success. No rows returned."

- [ ] **Step 3.4 — Add real Supabase credentials to .env.local**

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Find them at: Supabase dashboard → Settings → API

- [ ] **Step 3.5 — Commit**

```bash
git add src/lib/supabase.ts src/supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase client and initial DB schema migration"
```

---

## Task 4: Dexie Offline Database

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/test/lib/db.test.ts`

- [ ] **Step 4.1 — Write failing test**

Create `src/test/lib/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'

describe('db', () => {
  beforeEach(async () => {
    await db.pockets.clear()
    await db.platforms.clear()
  })

  it('stores and retrieves a pocket', async () => {
    const id = crypto.randomUUID()
    await db.pockets.add({
      id,
      user_id: 'user-1',
      name: 'Nequi',
      type: 'bank',
      platform_id: null,
      balance: 150000,
      color: '#34d399',
      icon: '🟢',
      is_active: true,
      created_at: new Date().toISOString()
    })
    const found = await db.pockets.get(id)
    expect(found?.name).toBe('Nequi')
    expect(found?.balance).toBe(150000)
  })

  it('filters active pockets', async () => {
    await db.pockets.bulkAdd([
      { id: crypto.randomUUID(), user_id: 'u', name: 'A', type: 'cash', platform_id: null,
        balance: 0, color: '#000', icon: '💵', is_active: true, created_at: '' },
      { id: crypto.randomUUID(), user_id: 'u', name: 'B', type: 'bank', platform_id: null,
        balance: 0, color: '#000', icon: '💳', is_active: false, created_at: '' }
    ])
    const active = await db.pockets.where('is_active').equals(1).toArray()
    expect(active).toHaveLength(1)
    expect(active[0].name).toBe('A')
  })
})
```

- [ ] **Step 4.2 — Run test to verify it fails**

```bash
npx vitest run src/test/lib/db.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/db'`

- [ ] **Step 4.3 — Implement Dexie database**

Create `src/lib/db.ts`:

```typescript
import Dexie, { type Table } from 'dexie'
import type {
  UserProfile, Platform, Pocket, Category, Transaction,
  Debt, Collection, SavingGoal, Cadena, ScheduledEvent
} from '@/types'

class FinanzasDB extends Dexie {
  user_profiles!: Table<UserProfile>
  platforms!: Table<Platform>
  pockets!: Table<Pocket>
  categories!: Table<Category>
  transactions!: Table<Transaction>
  debts!: Table<Debt>
  collections!: Table<Collection>
  saving_goals!: Table<SavingGoal>
  cadenas!: Table<Cadena>
  scheduled_events!: Table<ScheduledEvent>

  constructor() {
    super('FinanzasDB')
    this.version(1).stores({
      user_profiles: 'id',
      platforms:     'id, user_id, is_active',
      pockets:       'id, user_id, type, platform_id, is_active',
      categories:    'id, user_id',
      transactions:  'id, user_id, date, pocket_id, type',
      debts:         'id, user_id, status',
      collections:   'id, user_id, status',
      saving_goals:  'id, user_id, is_active',
      cadenas:       'id, user_id, status',
      scheduled_events: 'id, user_id, due_date, status, type'
    })
  }
}

export const db = new FinanzasDB()
```

- [ ] **Step 4.4 — Run test to verify it passes**

```bash
npx vitest run src/test/lib/db.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 4.5 — Commit**

```bash
git add src/lib/db.ts src/test/lib/db.test.ts
git commit -m "feat: add Dexie offline-first database with all entity tables"
```

---

## Task 5: Auth Hook + Auth Page

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/pages/auth/AuthPage.tsx`
- Create: `src/test/hooks/useAuth.test.ts`

- [ ] **Step 5.1 — Write failing test**

Create `src/test/hooks/useAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn()
    }
  }
}))

describe('useAuth', () => {
  it('initializes with loading true then false', async () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    await act(async () => {})
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('exposes signIn, signUp, signOut functions', () => {
    const { result } = renderHook(() => useAuth())
    expect(typeof result.current.signIn).toBe('function')
    expect(typeof result.current.signUp).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
  })
})
```

- [ ] **Step 5.2 — Run test to verify it fails**

```bash
npx vitest run src/test/hooks/useAuth.test.ts
```

Expected: FAIL — `Cannot find module '@/hooks/useAuth'`

- [ ] **Step 5.3 — Implement useAuth hook**

Create `src/hooks/useAuth.ts`:

```typescript
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthHook {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    })
    if (!error && data.user) {
      await supabase.from('user_profiles').insert({
        id: data.user.id,
        name,
        onboarding_completed: false,
        balance_hidden: false
      })
    }
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signUp, signOut }
}
```

- [ ] **Step 5.4 — Run test to verify it passes**

```bash
npx vitest run src/test/hooks/useAuth.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5.5 — Build AuthPage**

Create `src/pages/auth/AuthPage.tsx`:

```tsx
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, name)
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-slate-100">Mis Finanzas</h1>
          <p className="text-slate-400 text-sm mt-1">Control financiero para trabajadores de apps</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Ingresar
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">NOMBRE</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">CORREO</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5.6 — Commit**

```bash
git add src/hooks/useAuth.ts src/pages/auth/AuthPage.tsx src/test/hooks/useAuth.test.ts
git commit -m "feat: add auth hook and login/register page"
```

---

## Task 6: App Shell + Navigation

**Files:**
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create all placeholder pages

- [ ] **Step 6.1 — Create BottomNav**

Create `src/components/layout/BottomNav.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import { Home, CreditCard, PlusCircle, List, BarChart2 } from 'lucide-react'

const tabs = [
  { to: '/',        icon: Home,       label: 'Inicio' },
  { to: '/bolsillos', icon: CreditCard, label: 'Bolsillos' },
  { to: '/registrar', icon: PlusCircle, label: 'Registrar', center: true },
  { to: '/historial', icon: List,       label: 'Historial' },
  { to: '/reportes',  icon: BarChart2,  label: 'Reportes' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                tab.center
                  ? 'bg-emerald-600 text-white p-2 rounded-full -mt-4 shadow-lg shadow-emerald-900'
                  : isActive
                    ? 'text-blue-400'
                    : 'text-slate-500'
              }`
            }
          >
            <tab.icon size={tab.center ? 26 : 20} />
            {!tab.center && <span className="text-[10px]">{tab.label}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 6.2 — Create AppShell**

Create `src/components/layout/AppShell.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <Outlet />
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 6.3 — Create placeholder pages**

Create `src/pages/home/HomePage.tsx`:
```tsx
export function HomePage() {
  return <div className="p-4"><h1 className="text-slate-100 text-xl font-bold">Inicio</h1><p className="text-slate-400 text-sm mt-1">Dashboard — Plan 5</p></div>
}
```

Create `src/pages/register/RegisterPage.tsx`:
```tsx
export function RegisterPage() {
  return <div className="p-4"><h1 className="text-slate-100 text-xl font-bold">Registrar</h1><p className="text-slate-400 text-sm mt-1">Registro de movimientos — Plan 2</p></div>
}
```

Create `src/pages/history/HistoryPage.tsx`:
```tsx
export function HistoryPage() {
  return <div className="p-4"><h1 className="text-slate-100 text-xl font-bold">Historial</h1><p className="text-slate-400 text-sm mt-1">Historial — Plan 2</p></div>
}
```

Create `src/pages/reports/ReportsPage.tsx`:
```tsx
export function ReportsPage() {
  return <div className="p-4"><h1 className="text-slate-100 text-xl font-bold">Reportes</h1><p className="text-slate-400 text-sm mt-1">Reportes — Plan 5</p></div>
}
```

- [ ] **Step 6.4 — Wire App.tsx router**

Replace `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AuthPage } from '@/pages/auth/AuthPage'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingFlow } from '@/pages/onboarding/OnboardingFlow'
import { HomePage } from '@/pages/home/HomePage'
import { PocketsPage } from '@/pages/pockets/PocketsPage'
import { RegisterPage } from '@/pages/register/RegisterPage'
import { HistoryPage } from '@/pages/history/HistoryPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Cargando...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingFlow />} />
      <Route element={<AppShell />}>
        <Route path="/"          element={<HomePage />} />
        <Route path="/bolsillos" element={<PocketsPage />} />
        <Route path="/registrar" element={<RegisterPage />} />
        <Route path="/historial" element={<HistoryPage />} />
        <Route path="/reportes"  element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
```

- [ ] **Step 6.5 — Wire main.tsx**

Replace `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6.6 — Replace index.css**

Replace `src/index.css`:

```css
@import "tailwindcss";

* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
input, button, select, textarea { font-family: inherit; }
```

- [ ] **Step 6.7 — Verify app renders**

```bash
npm run dev
```

Expected: App shows auth page. After login → bottom nav with 5 tabs. No console errors.

- [ ] **Step 6.8 — Commit**

```bash
git add src/
git commit -m "feat: add app shell, bottom nav, router, and placeholder pages"
```

---

## Task 7: usePockets Hook

**Files:**
- Create: `src/hooks/usePockets.ts`
- Create: `src/test/hooks/usePockets.test.ts`

- [ ] **Step 7.1 — Write failing tests**

Create `src/test/hooks/usePockets.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePockets } from '@/hooks/usePockets'
import { db } from '@/lib/db'

const TEST_USER = 'user-test-1'

beforeEach(async () => {
  await db.pockets.clear()
})

describe('usePockets', () => {
  it('loads pockets for a user', async () => {
    await db.pockets.add({
      id: '1', user_id: TEST_USER, name: 'Efectivo', type: 'cash',
      platform_id: null, balance: 50000, color: '#34d399', icon: '💵',
      is_active: true, created_at: new Date().toISOString()
    })

    const { result } = renderHook(() => usePockets(TEST_USER))
    await act(async () => {})

    expect(result.current.pockets).toHaveLength(1)
    expect(result.current.pockets[0].name).toBe('Efectivo')
  })

  it('calculates total balance', async () => {
    await db.pockets.bulkAdd([
      { id: '1', user_id: TEST_USER, name: 'A', type: 'cash', platform_id: null,
        balance: 100000, color: '#000', icon: '💵', is_active: true, created_at: '' },
      { id: '2', user_id: TEST_USER, name: 'B', type: 'bank', platform_id: null,
        balance: 250000, color: '#000', icon: '💳', is_active: true, created_at: '' }
    ])

    const { result } = renderHook(() => usePockets(TEST_USER))
    await act(async () => {})

    expect(result.current.totalBalance).toBe(350000)
  })

  it('adds a new pocket', async () => {
    const { result } = renderHook(() => usePockets(TEST_USER))
    await act(async () => {})

    await act(async () => {
      await result.current.addPocket({
        user_id: TEST_USER, name: 'Nequi', type: 'bank',
        platform_id: null, balance: 80000, color: '#34d399',
        icon: '🟢', is_active: true
      })
    })

    expect(result.current.pockets).toHaveLength(1)
    expect(result.current.pockets[0].name).toBe('Nequi')
  })

  it('updates pocket balance', async () => {
    const id = 'pocket-1'
    await db.pockets.add({
      id, user_id: TEST_USER, name: 'Nequi', type: 'bank',
      platform_id: null, balance: 100000, color: '#34d399',
      icon: '🟢', is_active: true, created_at: ''
    })

    const { result } = renderHook(() => usePockets(TEST_USER))
    await act(async () => {})
    await act(async () => { await result.current.updateBalance(id, 150000) })

    expect(result.current.pockets[0].balance).toBe(150000)
  })
})
```

- [ ] **Step 7.2 — Run tests to verify they fail**

```bash
npx vitest run src/test/hooks/usePockets.test.ts
```

Expected: FAIL — `Cannot find module '@/hooks/usePockets'`

- [ ] **Step 7.3 — Implement usePockets hook**

Create `src/hooks/usePockets.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Pocket } from '@/types'

type NewPocket = Omit<Pocket, 'id' | 'created_at'>

interface PocketsHook {
  pockets: Pocket[]
  totalBalance: number
  loading: boolean
  addPocket: (pocket: NewPocket) => Promise<void>
  updatePocket: (id: string, updates: Partial<Pocket>) => Promise<void>
  updateBalance: (id: string, newBalance: number) => Promise<void>
  deletePocket: (id: string) => Promise<void>
}

export function usePockets(userId: string): PocketsHook {
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.pockets
      .where('user_id').equals(userId)
      .and(p => p.is_active)
      .sortBy('created_at')
    setPockets(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const totalBalance = pockets.reduce((sum, p) => sum + p.balance, 0)

  const addPocket = async (pocket: NewPocket) => {
    const newPocket: Pocket = {
      ...pocket,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    }
    await db.pockets.add(newPocket)
    await load()
  }

  const updatePocket = async (id: string, updates: Partial<Pocket>) => {
    await db.pockets.update(id, updates)
    await load()
  }

  const updateBalance = async (id: string, newBalance: number) => {
    await db.pockets.update(id, { balance: newBalance })
    await load()
  }

  const deletePocket = async (id: string) => {
    await db.pockets.update(id, { is_active: false })
    await load()
  }

  return { pockets, totalBalance, loading, addPocket, updatePocket, updateBalance, deletePocket }
}
```

- [ ] **Step 7.4 — Run tests to verify they pass**

```bash
npx vitest run src/test/hooks/usePockets.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 7.5 — Commit**

```bash
git add src/hooks/usePockets.ts src/test/hooks/usePockets.test.ts
git commit -m "feat: add usePockets hook with CRUD and total balance"
```

---

## Task 8: Bolsillos Page

**Files:**
- Create: `src/pages/pockets/PocketCard.tsx`
- Create: `src/pages/pockets/PocketForm.tsx`
- Create: `src/pages/pockets/PocketsPage.tsx`
- Create: `src/components/shared/PrivacyToggle.tsx`
- Create: `src/test/pages/pockets/PocketsPage.test.tsx`

- [ ] **Step 8.1 — Create PrivacyToggle**

Create `src/components/shared/PrivacyToggle.tsx`:

```tsx
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  hidden: boolean
  onToggle: () => void
}

export function PrivacyToggle({ hidden, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
      className="p-1.5 rounded-full bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
    >
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )
}

export function maskAmount(amount: number, hidden: boolean): string {
  if (hidden) return '••••••'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)
}
```

- [ ] **Step 8.2 — Create PocketCard**

Create `src/pages/pockets/PocketCard.tsx`:

```tsx
import type { Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'

interface Props {
  pocket: Pocket
  hidden: boolean
  onEdit: (pocket: Pocket) => void
}

export function PocketCard({ pocket, hidden, onEdit }: Props) {
  return (
    <button
      onClick={() => onEdit(pocket)}
      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-slate-600 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{pocket.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{pocket.name}</p>
            <p className="text-xs text-slate-400 capitalize">{pocket.type === 'cash' ? 'Efectivo' : pocket.type === 'bank' ? 'Banco/Digital' : 'Plataforma'}</p>
          </div>
        </div>
        <p className="text-base font-bold" style={{ color: pocket.color }}>
          {maskAmount(pocket.balance, hidden)}
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 8.3 — Create PocketForm**

Create `src/pages/pockets/PocketForm.tsx`:

```tsx
import { useState } from 'react'
import type { Pocket, PocketType } from '@/types'

interface Props {
  userId: string
  initial?: Pocket
  onSave: (data: Omit<Pocket, 'id' | 'created_at'>) => void
  onCancel: () => void
}

const ICONS: Record<PocketType, { default: string; options: string[] }> = {
  cash:     { default: '💵', options: ['💵', '💰', '🪙'] },
  bank:     { default: '💳', options: ['💳', '🟢', '🏦', '📱'] },
  platform: { default: '📲', options: ['🛵', '🚗', '🍔', '📲'] }
}

const COLORS = ['#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f87171', '#fbbf24', '#94a3b8']

export function PocketForm({ userId, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<PocketType>(initial?.type ?? 'bank')
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? '0')
  const [color, setColor] = useState(initial?.color ?? '#34d399')
  const [icon, setIcon] = useState(initial?.icon ?? '💳')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      user_id: userId,
      name: name.trim(),
      type,
      platform_id: null,
      balance: parseFloat(balance) || 0,
      color,
      icon,
      is_active: true
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">NOMBRE</label>
        <input
          value={name} onChange={e => setName(e.target.value)} required
          placeholder="Ej: Nequi, Bancolombia, Efectivo"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">TIPO</label>
        <div className="flex gap-2">
          {(['cash', 'bank', 'platform'] as PocketType[]).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${type === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {t === 'cash' ? 'Efectivo' : t === 'bank' ? 'Banco/Digital' : 'Plataforma'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">ÍCONO</label>
        <div className="flex gap-2">
          {ICONS[type].options.map(ic => (
            <button key={ic} type="button" onClick={() => setIcon(ic)}
              className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-colors ${icon === ic ? 'bg-blue-600' : 'bg-slate-800'}`}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">COLOR</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-colors ${color === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">SALDO ACTUAL</label>
        <input type="number" value={balance} onChange={e => setBalance(e.target.value)}
          min="0" step="1000"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl font-medium text-sm">
          Cancelar
        </button>
        <button type="submit"
          className="flex-2 bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold text-sm">
          {initial ? 'Guardar cambios' : 'Agregar bolsillo'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 8.4 — Write PocketsPage test**

Create `src/test/pages/pockets/PocketsPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PocketsPage } from '@/pages/pockets/PocketsPage'
import { db } from '@/lib/db'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) } }
}))

beforeEach(async () => { await db.pockets.clear() })

describe('PocketsPage', () => {
  it('shows empty state when no pockets', async () => {
    render(<MemoryRouter><PocketsPage userId="u1" /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Agrega tu primer bolsillo/i)).toBeInTheDocument())
  })

  it('renders pockets from db', async () => {
    await db.pockets.add({
      id: '1', user_id: 'u1', name: 'Nequi', type: 'bank',
      platform_id: null, balance: 120000, color: '#34d399',
      icon: '🟢', is_active: true, created_at: ''
    })
    render(<MemoryRouter><PocketsPage userId="u1" /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Nequi')).toBeInTheDocument())
  })
})
```

- [ ] **Step 8.5 — Run test to verify it fails**

```bash
npx vitest run src/test/pages/pockets/PocketsPage.test.tsx
```

Expected: FAIL — `Cannot find module '@/pages/pockets/PocketsPage'`

- [ ] **Step 8.6 — Implement PocketsPage**

Create `src/pages/pockets/PocketsPage.tsx`:

```tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { usePockets } from '@/hooks/usePockets'
import { PocketCard } from './PocketCard'
import { PocketForm } from './PocketForm'
import { PrivacyToggle, maskAmount } from '@/components/shared/PrivacyToggle'
import type { Pocket } from '@/types'

interface Props { userId: string }

export function PocketsPage({ userId }: Props) {
  const { pockets, totalBalance, loading, addPocket, updatePocket } = usePockets(userId)
  const [hidden, setHidden] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Pocket | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando...</div>

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-6 border border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-400">SALDO TOTAL</p>
          <PrivacyToggle hidden={hidden} onToggle={() => setHidden(h => !h)} />
        </div>
        <p className="text-3xl font-bold text-emerald-400">{maskAmount(totalBalance, hidden)}</p>
        <p className="text-xs text-slate-500 mt-1">{pockets.length} bolsillo{pockets.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Pockets list */}
      <div className="space-y-3 mb-4">
        {pockets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💳</p>
            <p className="text-slate-400 text-sm">Agrega tu primer bolsillo</p>
          </div>
        ) : (
          pockets.map(p => (
            <PocketCard key={p.id} pocket={p} hidden={hidden} onEdit={setEditing} />
          ))
        )}
      </div>

      {/* Add button */}
      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-dashed border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 py-4 rounded-xl transition-colors text-sm">
        <Plus size={16} /> Agregar bolsillo
      </button>

      {/* Add form modal */}
      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-0">
          <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl p-6 border-t border-slate-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-100 mb-4">
              {editing ? 'Editar bolsillo' : 'Nuevo bolsillo'}
            </h2>
            <PocketForm
              userId={userId}
              initial={editing ?? undefined}
              onSave={async data => {
                if (editing) {
                  await updatePocket(editing.id, data)
                  setEditing(null)
                } else {
                  await addPocket(data)
                  setShowForm(false)
                }
              }}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8.7 — Wire PocketsPage in App.tsx**

In `src/App.tsx`, the `PocketsPage` needs the `userId`. Update the route:

```tsx
// Add this import at the top of App.tsx
import { PocketsPage } from '@/pages/pockets/PocketsPage'

// Replace the pockets route inside AppRoutes():
<Route path="/bolsillos" element={user ? <PocketsPage userId={user.id} /> : null} />
```

- [ ] **Step 8.8 — Run test to verify it passes**

```bash
npx vitest run src/test/pages/pockets/PocketsPage.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 8.9 — Commit**

```bash
git add src/
git commit -m "feat: add Bolsillos page with add/edit pockets, privacy toggle, and balance"
```

---

## Task 9: Onboarding Flow

**Files:**
- Create: `src/pages/onboarding/OnboardingFlow.tsx`
- Create: `src/pages/onboarding/Step1Name.tsx`
- Create: `src/pages/onboarding/Step2Platforms.tsx`
- Create: `src/pages/onboarding/Step3Pockets.tsx`
- Create: `src/pages/onboarding/Step4PlatformBalances.tsx`
- Create: `src/pages/onboarding/Step5PayoutDays.tsx`
- Create: `src/test/pages/onboarding/OnboardingFlow.test.tsx`

- [ ] **Step 9.1 — Write failing test**

Create `src/test/pages/onboarding/OnboardingFlow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingFlow } from '@/pages/onboarding/OnboardingFlow'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) }
  }
}))

describe('OnboardingFlow', () => {
  it('renders step 1 with name input', () => {
    render(<MemoryRouter><OnboardingFlow userId="u1" onComplete={vi.fn()} /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/tu nombre/i)).toBeInTheDocument()
  })

  it('advances to step 2 after entering name', async () => {
    render(<MemoryRouter><OnboardingFlow userId="u1" onComplete={vi.fn()} /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: 'José' } })
    fireEvent.click(screen.getByText(/Siguiente/i))
    await waitFor(() => expect(screen.getByText(/plataformas/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 9.2 — Run test to verify it fails**

```bash
npx vitest run src/test/pages/onboarding/OnboardingFlow.test.tsx
```

Expected: FAIL — `Cannot find module '@/pages/onboarding/OnboardingFlow'`

- [ ] **Step 9.3 — Build Step1Name**

Create `src/pages/onboarding/Step1Name.tsx`:

```tsx
import { useState } from 'react'

interface Props { initial: string; onNext: (name: string) => void }

export function Step1Name({ initial, onNext }: Props) {
  const [name, setName] = useState(initial)
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">👋</div>
        <h2 className="text-xl font-bold text-slate-100">¡Bienvenido!</h2>
        <p className="text-slate-400 text-sm mt-1">Configura tu app en 5 pasos rápidos</p>
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">TU NOMBRE</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base"
        />
      </div>
      <button onClick={() => name.trim() && onNext(name.trim())} disabled={!name.trim()}
        className="w-full bg-blue-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl">
        Siguiente →
      </button>
    </div>
  )
}
```

- [ ] **Step 9.4 — Build Step2Platforms**

Create `src/pages/onboarding/Step2Platforms.tsx`:

```tsx
import { useState } from 'react'
import { PLATFORM_DEFAULTS } from '@/types'

interface Props { initial: string[]; onNext: (platforms: string[]) => void; onBack: () => void }

const ALL_PLATFORMS = Object.keys(PLATFORM_DEFAULTS)

export function Step2Platforms({ initial, onNext, onBack }: Props) {
  const [selected, setSelected] = useState<string[]>(initial)

  const toggle = (p: string) =>
    setSelected(s => s.includes(p) ? s.filter(x => x !== p) : [...s, p])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📲</div>
        <h2 className="text-xl font-bold text-slate-100">¿En qué plataformas trabajas?</h2>
        <p className="text-slate-400 text-sm mt-1">Selecciona todas las que apliquen</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ALL_PLATFORMS.map(p => {
          const def = PLATFORM_DEFAULTS[p]
          const on = selected.includes(p)
          return (
            <button key={p} onClick={() => toggle(p)}
              className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${on ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
              <span className="text-xl">{def.icon}</span>
              <span style={{ color: on ? def.color : undefined }}>{p}</span>
            </button>
          )
        })}
        <button onClick={() => {}} className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-slate-600 text-slate-500 text-sm">
          <span>➕</span> Otra
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => selected.length > 0 && onNext(selected)} disabled={selected.length === 0}
          className="flex-2 bg-blue-600 disabled:opacity-40 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.5 — Build Step3Pockets**

Create `src/pages/onboarding/Step3Pockets.tsx`:

```tsx
import { useState } from 'react'
import type { PocketDraft } from '@/types'

interface Props {
  initial: PocketDraft[]
  onNext: (pockets: PocketDraft[]) => void
  onBack: () => void
}

const PRESETS: PocketDraft[] = [
  { name: 'Efectivo', type: 'cash',  balance: 0, color: '#34d399', icon: '💵' },
  { name: 'Nequi',   type: 'bank',  balance: 0, color: '#34d399', icon: '🟢' },
  { name: 'Daviplata',type: 'bank', balance: 0, color: '#fbbf24', icon: '🟡' },
]

export function Step3Pockets({ initial, onNext, onBack }: Props) {
  const [pockets, setPockets] = useState<PocketDraft[]>(
    initial.length > 0 ? initial : PRESETS
  )

  const updateBalance = (idx: number, val: string) =>
    setPockets(ps => ps.map((p, i) => i === idx ? { ...p, balance: parseFloat(val) || 0 } : p))

  const addPocket = () =>
    setPockets(ps => [...ps, { name: '', type: 'bank', balance: 0, color: '#94a3b8', icon: '💳' }])

  const updateName = (idx: number, val: string) =>
    setPockets(ps => ps.map((p, i) => i === idx ? { ...p, name: val } : p))

  const remove = (idx: number) =>
    setPockets(ps => ps.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">💳</div>
        <h2 className="text-xl font-bold text-slate-100">Tus bolsillos</h2>
        <p className="text-slate-400 text-sm mt-1">¿Cuánto tienes ahora en cada uno?</p>
      </div>
      <div className="space-y-3">
        {pockets.map((p, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xl">{p.icon}</span>
            <input value={p.name} onChange={e => updateName(i, e.target.value)}
              placeholder="Nombre"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none min-w-0" />
            <input type="number" value={p.balance || ''} onChange={e => updateBalance(i, e.target.value)}
              placeholder="$0" min="0"
              className="w-28 bg-slate-900 rounded-lg px-2 py-1.5 text-sm text-emerald-400 text-right focus:outline-none" />
            {pockets.length > 1 && (
              <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 text-lg">×</button>
            )}
          </div>
        ))}
        <button onClick={addPocket}
          className="w-full text-slate-500 text-sm py-2 border border-dashed border-slate-700 rounded-xl hover:border-slate-500">
          + Agregar cuenta bancaria
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => onNext(pockets.filter(p => p.name.trim()))}
          className="flex-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.6 — Build Step4PlatformBalances**

Create `src/pages/onboarding/Step4PlatformBalances.tsx`:

```tsx
import { useState } from 'react'
import { PLATFORM_DEFAULTS } from '@/types'

interface Props {
  platforms: string[]
  initial: Record<string, number>
  onNext: (balances: Record<string, number>) => void
  onBack: () => void
}

export function Step4PlatformBalances({ platforms, initial, onNext, onBack }: Props) {
  const [balances, setBalances] = useState<Record<string, number>>(initial)

  const update = (name: string, val: string) =>
    setBalances(b => ({ ...b, [name]: parseFloat(val) || 0 }))

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📊</div>
        <h2 className="text-xl font-bold text-slate-100">Saldo en plataformas</h2>
        <p className="text-slate-400 text-sm mt-1">¿Cuánto tienes acumulado esta semana?</p>
      </div>
      <div className="space-y-3">
        {platforms.map(name => {
          const def = PLATFORM_DEFAULTS[name] ?? { color: '#94a3b8', icon: '📲' }
          return (
            <div key={name} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">{def.icon}</span>
              <span className="flex-1 text-sm font-medium" style={{ color: def.color }}>{name}</span>
              <input type="number" value={balances[name] || ''} onChange={e => update(name, e.target.value)}
                placeholder="$0" min="0"
                className="w-32 bg-slate-900 rounded-lg px-2 py-1.5 text-sm text-emerald-400 text-right focus:outline-none" />
            </div>
          )
        })}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => onNext(balances)}
          className="flex-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.7 — Build Step5PayoutDays**

Create `src/pages/onboarding/Step5PayoutDays.tsx`:

```tsx
import { useState } from 'react'
import type { PayoutConfig } from '@/types'
import { PLATFORM_DEFAULTS, DAYS_OF_WEEK } from '@/types'

interface Props {
  platforms: string[]
  pocketOptions: Array<{ id: string; name: string }>
  initial: Record<string, PayoutConfig>
  onFinish: (config: Record<string, PayoutConfig>) => void
  onBack: () => void
}

export function Step5PayoutDays({ platforms, pocketOptions, initial, onFinish, onBack }: Props) {
  const [config, setConfig] = useState<Record<string, PayoutConfig>>(
    Object.fromEntries(platforms.map(p => [p, initial[p] ?? { day: 2, pocket_id: pocketOptions[0]?.id ?? '' }]))
  )

  const update = (platform: string, key: keyof PayoutConfig, val: number | string) =>
    setConfig(c => ({ ...c, [platform]: { ...c[platform], [key]: val } }))

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📅</div>
        <h2 className="text-xl font-bold text-slate-100">Días de pago</h2>
        <p className="text-slate-400 text-sm mt-1">¿Qué día te transfiere cada plataforma?</p>
      </div>
      <div className="space-y-4">
        {platforms.map(name => {
          const def = PLATFORM_DEFAULTS[name] ?? { color: '#94a3b8', icon: '📲' }
          const cfg = config[name]
          return (
            <div key={name} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{def.icon}</span>
                <span className="font-semibold text-sm" style={{ color: def.color }}>{name}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">DÍA DE PAGO</p>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <button key={i} onClick={() => update(name, 'day', i)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${cfg.day === i ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">DEPOSITAR EN</p>
                <select value={cfg.pocket_id} onChange={e => update(name, 'pocket_id', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none">
                  {pocketOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => onFinish(config)}
          className="flex-2 bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl text-sm">
          🚀 ¡Listo! Ir al inicio
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.8 — Build OnboardingFlow**

Create `src/pages/onboarding/OnboardingFlow.tsx`:

```tsx
import { useState } from 'react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { OnboardingData, PocketDraft, PayoutConfig } from '@/types'
import { PLATFORM_DEFAULTS } from '@/types'
import { Step1Name } from './Step1Name'
import { Step2Platforms } from './Step2Platforms'
import { Step3Pockets } from './Step3Pockets'
import { Step4PlatformBalances } from './Step4PlatformBalances'
import { Step5PayoutDays } from './Step5PayoutDays'

interface Props { userId: string; onComplete: () => void }

const empty: OnboardingData = {
  name: '', platforms: [], pockets: [],
  platformBalances: {}, payoutConfig: {}
}

export function OnboardingFlow({ userId, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(empty)
  const [saving, setSaving] = useState(false)

  const progress = (step / 5) * 100

  const finish = async (payoutConfig: Record<string, PayoutConfig>) => {
    setSaving(true)
    const finalData = { ...data, payoutConfig }

    // 1. Save bank/cash pockets to Dexie
    const savedPockets: Array<{ id: string; name: string }> = []
    for (const draft of finalData.pockets) {
      const pocket = {
        id: crypto.randomUUID(),
        user_id: userId,
        ...draft,
        platform_id: null,
        is_active: true,
        created_at: new Date().toISOString()
      }
      await db.pockets.add(pocket)
      savedPockets.push({ id: pocket.id, name: pocket.name })
    }

    // 2. Save platforms + their pockets to Dexie
    for (const platformName of finalData.platforms) {
      const def = PLATFORM_DEFAULTS[platformName] ?? { color: '#94a3b8', icon: '📲' }
      const platformId = crypto.randomUUID()

      const pocketId = crypto.randomUUID()
      await db.pockets.add({
        id: pocketId, user_id: userId, name: platformName, type: 'platform',
        platform_id: platformId, balance: finalData.platformBalances[platformName] ?? 0,
        color: def.color, icon: def.icon, is_active: true, created_at: new Date().toISOString()
      })

      const payoutPocketId = finalData.payoutConfig[platformName]?.pocket_id
        ?? savedPockets[0]?.id ?? ''

      await db.platforms.add({
        id: platformId, user_id: userId, name: platformName, color: def.color,
        payout_day: finalData.payoutConfig[platformName]?.day ?? 2,
        payout_pocket_id: payoutPocketId, is_active: true, created_at: new Date().toISOString()
      })
    }

    // 3. Mark onboarding complete in Supabase
    await supabase.from('user_profiles').upsert({
      id: userId, name: finalData.name,
      onboarding_completed: true, balance_hidden: false
    })

    setSaving(false)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Paso {step} de 5</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
          {step === 1 && (
            <Step1Name initial={data.name}
              onNext={name => { setData(d => ({ ...d, name })); setStep(2) }} />
          )}
          {step === 2 && (
            <Step2Platforms initial={data.platforms}
              onNext={platforms => { setData(d => ({ ...d, platforms })); setStep(3) }}
              onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step3Pockets initial={data.pockets}
              onNext={(pockets: PocketDraft[]) => { setData(d => ({ ...d, pockets })); setStep(4) }}
              onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <Step4PlatformBalances
              platforms={data.platforms}
              initial={data.platformBalances}
              onNext={platformBalances => { setData(d => ({ ...d, platformBalances })); setStep(5) }}
              onBack={() => setStep(3)} />
          )}
          {step === 5 && (
            <Step5PayoutDays
              platforms={data.platforms}
              pocketOptions={data.pockets.filter(p => p.type !== 'platform').map((p, i) => ({ id: `draft-${i}`, name: p.name }))}
              initial={data.payoutConfig}
              onFinish={finish}
              onBack={() => setStep(4)} />
          )}
          {saving && (
            <div className="absolute inset-0 bg-slate-950/80 rounded-3xl flex items-center justify-center">
              <p className="text-slate-400 animate-pulse">Guardando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.9 — Run test to verify it passes**

```bash
npx vitest run src/test/pages/onboarding/OnboardingFlow.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 9.10 — Wire onboarding into App.tsx**

In `src/App.tsx`, update `AppRoutes` to check onboarding status:

```tsx
// Replace the AppRoutes function body with:
function AppRoutes() {
  const { user, loading } = useAuth()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { setOnboardingDone(null); return }
    db.user_profiles.get(user.id).then(profile => {
      setOnboardingDone(profile?.onboarding_completed ?? false)
    })
  }, [user])

  if (loading || (user && onboardingDone === null)) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Cargando...</div>
    </div>
  }

  if (!user) return <AuthPage />

  if (!onboardingDone) {
    return <OnboardingFlow userId={user.id} onComplete={() => setOnboardingDone(true)} />
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"          element={<HomePage />} />
        <Route path="/bolsillos" element={<PocketsPage userId={user.id} />} />
        <Route path="/registrar" element={<RegisterPage />} />
        <Route path="/historial" element={<HistoryPage />} />
        <Route path="/reportes"  element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

Add missing imports to `App.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { db } from '@/lib/db'
```

- [ ] **Step 9.11 — Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS. No failures.

- [ ] **Step 9.12 — Commit**

```bash
git add src/
git commit -m "feat: add 5-step onboarding flow with platform, pockets, and payout setup"
```

---

## Task 10: Final Verification + Build Check

- [ ] **Step 10.1 — Run full test suite**

```bash
npx vitest run --coverage
```

Expected: All tests pass. Coverage report generated.

- [ ] **Step 10.2 — Build for production**

```bash
npm run build
```

Expected: `dist/` folder created. No TypeScript errors. No build errors.

- [ ] **Step 10.3 — Preview PWA build**

```bash
npm run preview
```

Expected: App loads at `http://localhost:4173`. Service worker registers. Manifest visible in DevTools → Application.

- [ ] **Step 10.4 — Final commit**

```bash
git add -A
git commit -m "feat: Plan 1 complete — Foundation, Auth, Onboarding, Bolsillos PWA"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered |
|---|---|
| PWA + Supabase stack | ✅ Task 1, 3 |
| Offline-first (Dexie) | ✅ Task 4 |
| Auth (login/register) | ✅ Task 5 |
| Onboarding 5 steps | ✅ Task 9 |
| Bolsillos CRUD | ✅ Tasks 7, 8 |
| Privacy toggle (eye icon) | ✅ Task 8 |
| Bottom navigation | ✅ Task 6 |
| TypeScript types for all entities | ✅ Task 2 |
| Supabase DB schema | ✅ Task 3 |

**Placeholder scan:** No TBDs, no "similar to task N", all code blocks complete.

**Type consistency:** `Pocket`, `Platform`, `OnboardingData`, `PocketDraft`, `PayoutConfig` defined in Task 2 and used consistently in Tasks 7–9.
