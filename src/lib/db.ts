import Dexie, { type Table } from 'dexie'
import type {
  UserProfile, Platform, Pocket, Category, Transaction,
  Debt, Collection, SavingGoal, Cadena, ScheduledEvent
} from '@/types'

// IndexedDB cannot index booleans — coerce them to 0/1 for indexed boolean fields
function coerceBooleans<T extends object>(obj: T, fields: (keyof T)[]): T {
  const copy = { ...obj }
  for (const field of fields) {
    if (typeof copy[field] === 'boolean') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(copy as any)[field] = copy[field] ? 1 : 0
    }
  }
  return copy
}

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

    // Coerce boolean is_active → 0/1 so IndexedDB can index and filter it
    this.pockets.hook('creating', (_key, obj) => {
      const coerced = coerceBooleans(obj, ['is_active'])
      Object.assign(obj, coerced)
    })
    this.pockets.hook('updating', (mods) => {
      if ('is_active' in mods && typeof mods.is_active === 'boolean') {
        return { ...mods, is_active: mods.is_active ? 1 : 0 }
      }
    })
    this.platforms.hook('creating', (_key, obj) => {
      const coerced = coerceBooleans(obj, ['is_active'])
      Object.assign(obj, coerced)
    })
    this.platforms.hook('updating', (mods) => {
      if ('is_active' in mods && typeof mods.is_active === 'boolean') {
        return { ...mods, is_active: mods.is_active ? 1 : 0 }
      }
    })
    this.saving_goals.hook('creating', (_key, obj) => {
      const coerced = coerceBooleans(obj, ['is_active'])
      Object.assign(obj, coerced)
    })
    this.saving_goals.hook('updating', (mods) => {
      if ('is_active' in mods && typeof mods.is_active === 'boolean') {
        return { ...mods, is_active: mods.is_active ? 1 : 0 }
      }
    })
  }
}

export const db = new FinanzasDB()
