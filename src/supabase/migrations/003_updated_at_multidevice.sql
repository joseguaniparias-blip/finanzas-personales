-- Run this in the Supabase SQL Editor after 002_recurring_and_category_kind.sql.
--
-- Migration 003 — multi-device sync (last-writer-wins).
--
-- Adds an `updated_at` column to every synced table. The client stamps it on
-- every write; on pull, each row is compared by `updated_at` and only the newer
-- version wins. This lets a change made on phone B reach phone A instead of
-- being skipped (the old pull only ran when the local store was empty).
--
-- Idempotent: safe to run more than once.

alter table user_profiles      add column if not exists updated_at timestamptz not null default now();
alter table platforms          add column if not exists updated_at timestamptz not null default now();
alter table pockets            add column if not exists updated_at timestamptz not null default now();
alter table categories         add column if not exists updated_at timestamptz not null default now();
alter table transactions       add column if not exists updated_at timestamptz not null default now();
alter table debts              add column if not exists updated_at timestamptz not null default now();
alter table collections        add column if not exists updated_at timestamptz not null default now();
alter table saving_goals       add column if not exists updated_at timestamptz not null default now();
alter table cadenas            add column if not exists updated_at timestamptz not null default now();
alter table scheduled_events   add column if not exists updated_at timestamptz not null default now();
alter table recurring_payments add column if not exists updated_at timestamptz not null default now();
