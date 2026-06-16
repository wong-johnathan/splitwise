import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// POST /api/expenses — create expense with splits
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { groupId, description, amount, splitMethod, paidBy, splits, date } = req.body;

    if (!groupId || !description || !amount) {
      return res.status(400).json({ error: 'groupId, description, and amount are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Verify user is a group member
    const memberCheck = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const payerId = paidBy || req.userId;

    const expenseResult = await query(
      `INSERT INTO expenses (group_id, paid_by, description, amount, split_method, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [groupId, payerId, description, numAmount, splitMethod || 'equal', date || new Date()]
    );

    const expenseId = expenseResult.rows[0].id;

    if (splitMethod === 'equal' || !splitMethod) {
      // Get all group members
      const members = await query(
        'SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY user_id',
        [groupId]
      );

      const memberCount = members.rows.length;
      const baseShare = Math.floor((numAmount * 100) / memberCount) / 100;
      const remainder = Math.round((numAmount - baseShare * memberCount) * 100) / 100;

      for (let i = 0; i < memberCount; i++) {
        const shareAmount = i === 0 ? baseShare + remainder : baseShare;
        await query(
          'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
          [expenseId, members.rows[i].user_id, shareAmount]
        );
      }
    } else if (splitMethod === 'custom' && Array.isArray(splits)) {
      for (const split of splits) {
        if (!split.userId || !split.amount) continue;
        await query(
          'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
          [expenseId, split.userId, parseFloat(split.amount)]
        );
      }
    }

    // Return the expense with splits
    const splitsResult = await query(
      'SELECT * FROM expense_splits WHERE expense_id = $1',
      [expenseId]
    );

    res.status(201).json({
      expense: { ...expenseResult.rows[0], amount: parseFloat(expenseResult.rows[0].amount) },
      splits: splitsResult.rows,
    });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/expenses?groupId=X — list expenses for a group
router.get('/', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'groupId query parameter is required' });
    }

    const result = await query(
      `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.group_id = $1
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [groupId]
    );

    // Attach splits to each expense
    const expenses = await Promise.all(
      result.rows.map(async (expense) => {
        const splitsResult = await query(
          `SELECT es.*, u.name, u.email
           FROM expense_splits es
           JOIN users u ON u.id = es.user_id
           WHERE es.expense_id = $1
           ORDER BY es.id`,
          [expense.id]
        );
        return {
          ...expense,
          amount: parseFloat(expense.amount),
          splits: splitsResult.rows.map((s: any) => ({
            ...s,
            amount: parseFloat(s.amount),
          })),
        };
      })
    );

    res.json({ expenses });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/expenses/:id — delete an expense (only the payer can delete)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND paid_by = $2 RETURNING id',
      [expenseId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or not authorized' });
    }

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
