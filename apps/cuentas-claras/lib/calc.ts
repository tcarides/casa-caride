// Cálculo de deudas de una cuenta, en centavos (enteros) para que cierre exacto.
// v1: cada gasto se divide en partes iguales entre TODOS los participantes.

export interface Balance {
  participantId: number
  paid: number      // lo que puso (centavos)
  share: number     // lo que le tocaba (centavos)
  balance: number   // paid - share: + le deben, - debe
}

export interface Transfer {
  from: number      // participantId que paga
  to: number        // participantId que cobra
  amount: number    // centavos
}

interface ExpenseLike { payerId: number; amount: number }

/**
 * Reparte el total en partes iguales y devuelve el saldo de cada participante.
 * El resto (centavos que no dividen exacto) se reparte de a 1 entre los
 * primeros participantes, así la suma de saldos da 0 exacto.
 */
export function computeBalances(participantIds: number[], expenses: ExpenseLike[]): Balance[] {
  const n = participantIds.length
  if (n === 0) return []

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const base = Math.floor(total / n)
  let remainder = total - base * n

  const paidBy = new Map<number, number>()
  for (const id of participantIds) paidBy.set(id, 0)
  for (const e of expenses) paidBy.set(e.payerId, (paidBy.get(e.payerId) ?? 0) + e.amount)

  return participantIds.map((id) => {
    const share = base + (remainder-- > 0 ? 1 : 0)
    const paid = paidBy.get(id) ?? 0
    return { participantId: id, paid, share, balance: paid - share }
  })
}

/**
 * Minimiza las transferencias: empareja el que más le deben con el que más
 * debe, hasta saldar todo (algoritmo greedy).
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.participantId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.participantId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    if (pay > 0) {
      transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay })
      debtors[i].amount -= pay
      creditors[j].amount -= pay
    }
    if (debtors[i].amount === 0) i++
    if (creditors[j].amount === 0) j++
  }
  return transfers
}
