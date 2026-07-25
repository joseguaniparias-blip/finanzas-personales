-- Run this in the Supabase SQL Editor after 003_updated_at_multidevice.sql.
--
-- Migration 004 — link transactions to the scheduled_event that generated them.
--
-- The agenda's confirm / partial-abono flow now tags each generated transaction
-- with `event_id` (the scheduled_events.id) so a confirmed payment can be
-- reversed or edited precisely later ("Corregir pago"). Without this column the
-- client push of any such transaction is rejected by PostgREST and parked in the
-- durable outbox forever — local works (Dexie is source of truth) but the row
-- never reaches the cloud / other devices.
--
-- Plain uuid, no foreign key — same as `reference_id` in this schema. A FK to
-- scheduled_events would break offline pushes that arrive out of order (the
-- transaction landing before its event), which the durable outbox otherwise
-- resolves. Nullable: manual transactions and legacy rows keep event_id = null.
-- Idempotent: safe to run more than once.

alter table transactions
  add column if not exists event_id uuid;

create index if not exists transactions_event_id_idx on transactions (event_id);
