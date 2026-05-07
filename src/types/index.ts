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
