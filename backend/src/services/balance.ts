export interface Debt {
  fromUser: number;
  toUser: number;
  amount: number;
}

export interface BalanceEntry {
  userId: number;
  balance: number;
}

/**
 * Simplifies debts among group members.
 *
 * Takes per-person net balances (positive = owed money, negative = owes money)
 * and produces the minimum set of debt transfers to settle everyone.
 *
 * Uses the greedy approach: match the biggest creditor with the biggest debtor.
 */
export function simplifyDebts(balances: BalanceEntry[]): Debt[] {
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .map((b) => ({ userId: b.userId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ userId: b.userId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const debts: Debt[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].amount, debtors[di].amount);

    if (amount > 0.01) {
      debts.push({
        fromUser: debtors[di].userId,
        toUser: creditors[ci].userId,
        amount: Math.round(amount * 100) / 100,
      });
    }

    creditors[ci].amount -= amount;
    debtors[di].amount -= amount;

    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return debts;
}
