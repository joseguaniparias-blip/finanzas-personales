import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { buildExport, exportFileName, EXPORT_TABLES } from '@/lib/exportData'

const USER = 'user-1'
const OTHER = 'user-2'

beforeEach(async () => {
  await Promise.all([db.user_profiles.clear(), db.pockets.clear(), db.transactions.clear()])
  await db.user_profiles.put({
    id: USER, name: 'José', onboarding_completed: true,
    balance_hidden: false, created_at: '2026-01-01T00:00:00.000Z',
  })
  await db.pockets.bulkAdd([
    { id: 'p1', user_id: USER, name: 'Efectivo', type: 'cash', platform_id: null,
      balance: 50000, color: '', icon: '', is_active: true, created_at: '' },
    { id: 'p2', user_id: OTHER, name: 'Ajeno', type: 'cash', platform_id: null,
      balance: 1, color: '', icon: '', is_active: true, created_at: '' },
  ])
})

describe('buildExport', () => {
  it('includes every table, so a backup is a complete picture', async () => {
    const data = await buildExport(USER)
    for (const name of EXPORT_TABLES) {
      expect(data.tables[name], `missing table ${name}`).toBeDefined()
    }
  })

  it('carries only this user’s rows', async () => {
    const data = await buildExport(USER)
    expect(data.tables.pockets).toHaveLength(1)
    expect((data.tables.pockets[0] as { id: string }).id).toBe('p1')
    expect(data.tables.user_profiles).toHaveLength(1)
  })

  it('stamps a version and the user it belongs to', async () => {
    const data = await buildExport(USER)
    expect(data.version).toBe(1)
    expect(data.user_id).toBe(USER)
    expect(data.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('survives a user with no profile yet', async () => {
    const data = await buildExport('nobody')
    expect(data.tables.user_profiles).toEqual([])
    expect(data.tables.transactions).toEqual([])
  })
})

describe('exportFileName', () => {
  it('is dated and safe as a filename', () => {
    expect(exportFileName(new Date('2026-08-21T15:04:05.000Z')))
      .toBe('mis-finanzas-2026-08-21.json')
  })
})
