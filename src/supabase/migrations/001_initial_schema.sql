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
