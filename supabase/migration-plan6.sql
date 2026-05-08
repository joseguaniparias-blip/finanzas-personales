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
