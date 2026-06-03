-- Run this in the Supabase SQL Editor after 001_initial_schema.sql.

-- ─── Category.kind ──────────────────────────────────────────────────────────
-- Distinguish income vs expense categories.
alter table categories
  add column if not exists kind text not null default 'expense'
  check (kind in ('income', 'expense'));

-- ─── Recurring payments ─────────────────────────────────────────────────────
create table if not exists recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  icon text not null default '📦',
  amount numeric(14,2) not null default 0,
  is_variable boolean not null default false,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  -- weekly: 0–6 (Sun–Sat). monthly: 1–28. yearly: month*100 + day (e.g. 304 = Mar 4)
  trigger_day integer not null,
  source_pocket_id uuid not null references pockets on delete restrict,
  category_id uuid references categories on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table recurring_payments enable row level security;
create policy "Users manage own recurring payments"
  on recurring_payments for all using (auth.uid() = user_id);

-- ─── Transactions — transfer support ────────────────────────────────────────
-- Two new optional columns to link the two legs of a pocket→pocket transfer.
alter table transactions
  add column if not exists transfer_group_id uuid,
  add column if not exists transfer_other_pocket_id uuid references pockets on delete set null;

-- Allow type='transfer' (was likely limited to income/expense in the original CHECK).
do $$
begin
  alter table transactions drop constraint if exists transactions_type_check;
exception when others then null;
end$$;

alter table transactions
  add constraint transactions_type_check
  check (type in ('income','expense','transfer'));

-- ─── scheduled_events.type — accept 'recurring' ────────────────────────────
-- If the original schema constrained EventType via CHECK, drop and recreate.
-- (If it was just text, this is a no-op.)
do $$
begin
  alter table scheduled_events drop constraint if exists scheduled_events_type_check;
exception when others then null;
end$$;

alter table scheduled_events
  add constraint scheduled_events_type_check
  check (type in ('debt','collection','saving','cadena','platform_payout','recurring'));
