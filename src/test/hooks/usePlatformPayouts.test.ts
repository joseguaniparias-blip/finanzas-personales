import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlatformPayouts } from '@/hooks/usePlatformPayouts'
import { SALDO_INICIAL } from '@/lib/transactions'
import { db } from '@/lib/db'

const USER = 'user-nuevo-1'
const PLATFORM = 'plat-1'
const PLAT_POCKET = 'pocket-plat-1'
const CASH_POCKET = 'pocket-cash-1'

/** Lo que el usuario escribe en el paso 4 del onboarding
 *  ("¿Cuánto tienes acumulado esta semana?"). */
const SALDO_ONBOARDING = 500_000
const GANANCIA_DOMINGO = 80_000

// La semana del caso real: se registró el sábado, trabajó el domingo, el corte
// le tocaba el lunes. El día de pago de la plataforma es el martes.
const SABADO = new Date(2026, 7, 22, 10, 0, 0)
const DOMINGO = new Date(2026, 7, 23, 20, 0, 0)
const LUNES = new Date(2026, 7, 24, 9, 0, 0)   // pasada la hora de gracia
const MARTES_PAGO = '2026-08-25'

beforeEach(async () => {
  await db.platforms.clear()
  await db.pockets.clear()
  await db.transactions.clear()
  await db.scheduled_events.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Bolsillos + plataforma tal como los deja el onboarding. `conRespaldo` marca
 *  la diferencia entre el onboarding corregido y el viejo (que escribía el
 *  saldo solo en `pockets.balance`, sin transacción que lo respaldara). */
async function seedOnboarding(opts: { conRespaldo: boolean }) {
  await db.pockets.add({
    id: CASH_POCKET, user_id: USER, name: 'Efectivo', type: 'cash',
    platform_id: null, balance: 100_000, color: '#34d399', icon: '💵',
    is_active: true, created_at: SABADO.toISOString()
  })
  await db.pockets.add({
    id: PLAT_POCKET, user_id: USER, name: 'Rappi', type: 'platform',
    platform_id: PLATFORM, balance: SALDO_ONBOARDING, color: '#f97316', icon: '🛵',
    is_active: true, created_at: SABADO.toISOString()
  })
  await db.platforms.add({
    id: PLATFORM, user_id: USER, name: 'Rappi', color: '#f97316',
    payout_day: 2, // martes
    payout_pocket_id: CASH_POCKET, is_active: true,
    created_at: SABADO.toISOString()
  })
  if (opts.conRespaldo) {
    await db.transactions.add({
      id: 'tx-seed', user_id: USER, type: 'income', amount: SALDO_ONBOARDING,
      pocket_id: PLAT_POCKET, category_id: null, platform_id: PLATFORM,
      reference_id: null, reference_type: SALDO_INICIAL, note: 'Saldo inicial Rappi',
      receipt_url: null, date: '2026-08-22', created_at: SABADO.toISOString()
    })
  }
}

/** La ganancia digital del domingo: entra al bolsillo de la plataforma. */
async function ganandoElDomingo() {
  await db.transactions.add({
    id: 'tx-dom', user_id: USER, type: 'income', amount: GANANCIA_DOMINGO,
    pocket_id: PLAT_POCKET, category_id: null, platform_id: PLATFORM,
    reference_id: null, reference_type: 'income_digital', note: 'Digital Rappi',
    receipt_url: null, date: '2026-08-23', created_at: DOMINGO.toISOString()
  })
  const p = await db.pockets.get(PLAT_POCKET)
  await db.pockets.update(PLAT_POCKET, { balance: p!.balance + GANANCIA_DOMINGO })
}

/** Monta el hook y espera a que su efecto async termine por completo.
 *  No se puede esperar por una condición concreta: parte de lo que se prueba
 *  es justamente que NO pase nada en ciertos días. */
async function runHook() {
  const { unmount } = renderHook(() => usePlatformPayouts(USER))
  await act(async () => { await new Promise(r => setTimeout(r, 300)) })
  unmount()
}

async function pendingPayouts() {
  return db.scheduled_events
    .where('user_id').equals(USER)
    .filter(e => e.type === 'platform_payout' && e.status === 'pending')
    .toArray()
}

async function saldoBilletera() {
  return (await db.pockets.get(PLAT_POCKET))!.balance
}

describe('usuario nuevo: el onboarding respalda el saldo declarado', () => {
  it('sábado: fija la línea base sin cerrar nada', async () => {
    await seedOnboarding({ conRespaldo: true })
    vi.setSystemTime(SABADO)

    await runHook()

    expect((await db.platforms.get(PLATFORM))?.last_closed_sunday).toBe('2026-08-16')
    expect(await pendingPayouts()).toHaveLength(0)
  })

  it('lunes: el corte incluye el saldo del onboarding + la ganancia del domingo', async () => {
    await seedOnboarding({ conRespaldo: true })

    vi.setSystemTime(SABADO)
    await runHook()

    vi.setSystemTime(DOMINGO)
    await ganandoElDomingo()
    await runHook()
    expect(await pendingPayouts()).toHaveLength(0)  // el domingo sigue abierto

    vi.setSystemTime(LUNES)
    await runHook()

    expect((await db.platforms.get(PLATFORM))?.last_closed_sunday).toBe('2026-08-23')
    const [evento] = await pendingPayouts()
    expect(evento).toBeDefined()
    expect(evento.amount).toBe(SALDO_ONBOARDING + GANANCIA_DOMINGO)
    expect(evento.due_date).toBe(MARTES_PAGO)
    expect(await saldoBilletera()).toBe(0)
  })

  it('el saldo inicial no se cuenta dos veces si el hook corre varias veces', async () => {
    await seedOnboarding({ conRespaldo: true })
    vi.setSystemTime(SABADO); await runHook()
    vi.setSystemTime(DOMINGO); await ganandoElDomingo(); await runHook()
    vi.setSystemTime(LUNES); await runHook(); await runHook(); await runHook()

    const eventos = await pendingPayouts()
    expect(eventos).toHaveLength(1)
    expect(eventos[0].amount).toBe(SALDO_ONBOARDING + GANANCIA_DOMINGO)
    expect(await saldoBilletera()).toBe(0)
  })
})

describe('usuario ya registrado con el onboarding viejo: rescate del saldo varado', () => {
  it('rescata el saldo cuando el cierre del lunes todavía no ha corrido', async () => {
    await seedOnboarding({ conRespaldo: false })

    vi.setSystemTime(SABADO)
    await runHook()                       // línea base: 2026-08-16

    vi.setSystemTime(DOMINGO)
    await ganandoElDomingo()

    vi.setSystemTime(LUNES)
    await runHook()

    const [evento] = await pendingPayouts()
    expect(evento).toBeDefined()
    expect(evento.amount).toBe(SALDO_ONBOARDING + GANANCIA_DOMINGO)
    expect(await saldoBilletera()).toBe(0)
  })

  it('rescata el saldo aunque el cierre ya haya pasado de largo (corte incompleto)', async () => {
    // Estado real del usuario: el lunes la app cerró la semana y solo cobró la
    // ganancia del domingo; los 500.000 del onboarding quedaron varados.
    await seedOnboarding({ conRespaldo: false })
    await ganandoElDomingo()
    await db.platforms.update(PLATFORM, { last_closed_sunday: '2026-08-23' })
    await db.pockets.update(PLAT_POCKET, { balance: SALDO_ONBOARDING })
    await db.scheduled_events.add({
      id: 'ev-parcial', user_id: USER, type: 'platform_payout',
      reference_id: PLATFORM, reference_type: 'platform',
      amount: GANANCIA_DOMINGO, due_date: MARTES_PAGO, status: 'pending',
      actual_pocket_id: null, partial_amount: null, remaining_after_partial: null,
      created_at: LUNES.toISOString()
    })

    vi.setSystemTime(LUNES)
    await runHook()

    const eventos = await pendingPayouts()
    expect(eventos).toHaveLength(1)
    expect(eventos[0].amount).toBe(SALDO_ONBOARDING + GANANCIA_DOMINGO)
    expect(eventos[0].due_date).toBe(MARTES_PAGO)
    expect(await saldoBilletera()).toBe(0)
  })

  it('rescata el saldo cuando el cierre no creó ningún evento (ganancia toda en efectivo)', async () => {
    // La ganancia del domingo fue 100% efectivo: no tocó el bolsillo de
    // plataforma, el cierre calculó 0 y no creó nada. Síntoma reportado:
    // "la app no le hizo el corte".
    await seedOnboarding({ conRespaldo: false })
    await db.transactions.add({
      id: 'tx-dom-cash', user_id: USER, type: 'income', amount: 60_000,
      pocket_id: CASH_POCKET, category_id: null, platform_id: PLATFORM,
      reference_id: null, reference_type: 'income_cash', note: 'Efectivo Rappi',
      receipt_url: null, date: '2026-08-23', created_at: DOMINGO.toISOString()
    })
    await db.pockets.update(CASH_POCKET, { balance: 160_000 })
    await db.platforms.update(PLATFORM, { last_closed_sunday: '2026-08-23' })

    vi.setSystemTime(LUNES)
    await runHook()

    const eventos = await pendingPayouts()
    expect(eventos).toHaveLength(1)
    expect(eventos[0].amount).toBe(SALDO_ONBOARDING)
    expect(eventos[0].due_date).toBe(MARTES_PAGO)
    expect(await saldoBilletera()).toBe(0)
    // El saldo rescatado queda en el historial, no aparecido de la nada
    const seed = await db.transactions.where('pocket_id').equals(PLAT_POCKET).toArray()
    expect(seed.filter(t => t.reference_type === SALDO_INICIAL)).toHaveLength(1)
  })

  it('el rescate corre una sola vez, no infla el cobro en cada apertura', async () => {
    await seedOnboarding({ conRespaldo: false })
    await db.platforms.update(PLATFORM, { last_closed_sunday: '2026-08-23' })

    vi.setSystemTime(LUNES)
    await runHook()
    await runHook()
    await runHook()

    const eventos = await pendingPayouts()
    expect(eventos).toHaveLength(1)
    expect(eventos[0].amount).toBe(SALDO_ONBOARDING)
    expect(await saldoBilletera()).toBe(0)
  })

  it('no inventa plata cuando la billetera está en cero', async () => {
    await seedOnboarding({ conRespaldo: false })
    await db.pockets.update(PLAT_POCKET, { balance: 0 })
    await db.platforms.update(PLATFORM, { last_closed_sunday: '2026-08-23' })

    vi.setSystemTime(LUNES)
    await runHook()

    expect(await pendingPayouts()).toHaveLength(0)
    expect(await saldoBilletera()).toBe(0)
    const txs = await db.transactions.where('pocket_id').equals(PLAT_POCKET).toArray()
    expect(txs.filter(t => t.reference_type === SALDO_INICIAL)).toHaveLength(0)
  })

  it('no toca la deuda con la plataforma (saldo negativo)', async () => {
    await seedOnboarding({ conRespaldo: false })
    await db.pockets.update(PLAT_POCKET, { balance: -40_000 })
    await db.platforms.update(PLATFORM, { last_closed_sunday: '2026-08-23' })

    vi.setSystemTime(LUNES)
    await runHook()

    expect(await pendingPayouts()).toHaveLength(0)
    expect(await saldoBilletera()).toBe(-40_000)
  })
})
