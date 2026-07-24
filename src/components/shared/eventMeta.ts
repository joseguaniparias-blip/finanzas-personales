import { CreditCard, HandCoins, PiggyBank, Users, Wallet, Repeat, type LucideIcon } from 'lucide-react'

/** Visual metadata (color, icon, label) for each scheduled-event type. Shared
 * by the Home agenda and the History correction flow. */
export const EVENT_META: Record<string, { color: string; Icon: LucideIcon; label: string }> = {
  debt:            { color: 'text-red-400',     Icon: CreditCard, label: 'Deuda' },
  collection:      { color: 'text-emerald-400', Icon: HandCoins,  label: 'Cobro' },
  saving:          { color: 'text-blue-400',    Icon: PiggyBank,  label: 'Ahorro' },
  cadena:          { color: 'text-violet-400',  Icon: Users,      label: 'Cadena' },
  platform_payout: { color: 'text-orange-400',  Icon: Wallet,     label: 'Pago plataforma' },
  recurring:       { color: 'text-teal-400',    Icon: Repeat,     label: 'Pago recurrente' },
}
