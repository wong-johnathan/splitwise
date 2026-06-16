import { simplifyDebts } from '../balance';

describe('balance service', () => {
  describe('simplifyDebts', () => {
    it('should return empty debts for empty input', () => {
      const result = simplifyDebts([]);
      expect(result).toEqual([]);
    });

    it('should return empty debts when all balances are zero', () => {
      const result = simplifyDebts([
        { userId: 1, balance: 0 },
        { userId: 2, balance: 0 },
      ]);
      expect(result).toEqual([]);
    });

    it('should return empty debts when balances are near-zero', () => {
      const result = simplifyDebts([
        { userId: 1, balance: 0.001 },
        { userId: 2, balance: -0.001 },
      ]);
      expect(result).toEqual([]);
    });

    it('should create a single debt for two people', () => {
      const result = simplifyDebts([
        { userId: 1, balance: 50 },
        { userId: 2, balance: -50 },
      ]);
      expect(result).toEqual([{ fromUser: 2, toUser: 1, amount: 50 }]);
    });

    it('should handle three people with simple debts', () => {
      const result = simplifyDebts([
        { userId: 1, balance: 100 },
        { userId: 2, balance: -40 },
        { userId: 3, balance: -60 },
      ]);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ fromUser: 2, toUser: 1, amount: 40 });
      expect(result).toContainEqual({ fromUser: 3, toUser: 1, amount: 60 });
    });

    it('should simplify cross debts (netting)', () => {
      // Alice is owed $10, Bob owes $30, Charlie is owed $20
      // Net: A=$10, B=-$30, C=$20
      // Simplest: Bob pays Alice $10, Bob pays Charlie $20
      const result = simplifyDebts([
        { userId: 1, balance: 10 },  // Alice
        { userId: 2, balance: -30 }, // Bob
        { userId: 3, balance: 20 },  // Charlie
      ]);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ fromUser: 2, toUser: 1, amount: 10 });
      expect(result).toContainEqual({ fromUser: 2, toUser: 3, amount: 20 });
    });

    it('should handle partial settlements correctly', () => {
      const result = simplifyDebts([
        { userId: 1, balance: 25 },
        { userId: 2, balance: -10 },
        { userId: 3, balance: -15 },
      ]);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ fromUser: 2, toUser: 1, amount: 10 });
      expect(result).toContainEqual({ fromUser: 3, toUser: 1, amount: 15 });
    });

    it('should handle all positive or all negative (edge case)', () => {
      // All positive means no one owes anyone
      const result = simplifyDebts([
        { userId: 1, balance: 10 },
        { userId: 2, balance: 20 },
      ]);
      expect(result).toEqual([]);
    });

    it('should round amounts to 2 decimal places', () => {
      const result = simplifyDebts([
        { userId: 1, balance: 33.3333 },
        { userId: 2, balance: -33.3333 },
      ]);
      expect(result[0].amount).toBe(33.33);
    });

    it('should handle four people with complex web of debts', () => {
      // A: +50, B: +20, C: -30, D: -40
      const result = simplifyDebts([
        { userId: 1, balance: 50 },
        { userId: 2, balance: 20 },
        { userId: 3, balance: -30 },
        { userId: 4, balance: -40 },
      ]);
      // 70 total positive, 70 total negative
      expect(result).toHaveLength(2);
      const totalFrom = result.reduce((sum, d) => sum + d.amount, 0);
      expect(totalFrom).toBeCloseTo(70, 1);
    });
  });
});
