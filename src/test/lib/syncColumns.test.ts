import { describe, it, expect } from 'vitest'
import { toSupabase, SUPABASE_COLUMNS } from '@/lib/sync'

describe('toSupabase column allowlist', () => {
  it('drops local-only fields that are not real Supabase columns', () => {
    // A Dexie row that carries a field the transactions table does not have.
    const row = {
      id: 't1', user_id: 'u', type: 'expense', amount: 1000, pocket_id: 'p1',
      event_id: 'e1', reference_id: 'd1', reference_type: 'debt',
      _uiSelected: true,           // purely local, must never be pushed
      bogus_column: 'x',           // simulates schema drift
    }
    const out = toSupabase('transactions', row)
    expect(out).not.toHaveProperty('_uiSelected')
    expect(out).not.toHaveProperty('bogus_column')
    // real columns survive
    expect(out).toMatchObject({ id: 't1', amount: 1000, event_id: 'e1', reference_id: 'd1' })
  })

  it('keeps every declared column when present', () => {
    const row = { id: 'p1', user_id: 'u', name: 'Rappi', color: '#f00',
      payout_day: 4, payout_pocket_id: null, is_active: true, created_at: '',
      updated_at: '', last_closed_sunday: '2026-06-28' }
    const out = toSupabase('platforms', row)
    expect(Object.keys(out).sort()).toEqual(Object.keys(row).sort())
  })

  it('converts 0/1 booleans back to real booleans', () => {
    const out = toSupabase('pockets', { id: 'p1', is_active: 1, balance: 500 })
    expect(out.is_active).toBe(true)
  })

  it('every table in the sync set has a column allowlist', () => {
    const tables = ['user_profiles', 'platforms', 'pockets', 'categories', 'transactions',
      'debts', 'collections', 'saving_goals', 'cadenas', 'scheduled_events', 'recurring_payments']
    for (const t of tables) {
      expect(SUPABASE_COLUMNS[t], `missing allowlist for ${t}`).toBeDefined()
      expect(SUPABASE_COLUMNS[t].length).toBeGreaterThan(0)
    }
  })
})
