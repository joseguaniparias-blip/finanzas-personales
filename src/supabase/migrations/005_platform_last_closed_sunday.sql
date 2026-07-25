-- Run this in the Supabase SQL Editor after 004_transaction_event_id.sql.
--
-- Migration 005 — persist the weekly-close marker for platform payouts.
--
-- usePlatformPayouts stamps `last_closed_sunday` on a platform when it snapshots
-- that week's earnings into a payout event, so the same Sunday is never closed
-- twice. The column existed only in the local Dexie store: pushes of it were
-- rejected by PostgREST (unknown column) and parked in the outbox forever, so
-- the marker never reached the cloud — on a second device the platform could
-- re-close a week and double-count earnings.
--
-- Idempotent: safe to run more than once.

alter table platforms
  add column if not exists last_closed_sunday date;
