import type { Transaction } from '@/types'

/**
 * Marca de la transacción que respalda el saldo que el usuario declaró al
 * registrarse ("¿Cuánto tienes acumulado esta semana?", paso 4 del onboarding).
 *
 * Existe porque el cierre semanal calcula el corte sumando TRANSACCIONES del
 * rango lunes→domingo. Un saldo escrito directo en `pockets.balance` es
 * invisible para el cierre y se queda varado en la billetera para siempre.
 *
 * Es plata que el usuario ya tenía: cuenta para el saldo y para el corte
 * semanal, pero NUNCA para los totales de ingresos — si no, el día en que se
 * registró aparece con una ganancia enorme que no hizo ese día.
 */
export const SALDO_INICIAL = 'saldo_inicial'

/** ¿Es una ganancia real? Excluye el saldo inicial declarado al registrarse. */
export function isEarning(t: Transaction): boolean {
  return t.type === 'income' && t.reference_type !== SALDO_INICIAL
}
