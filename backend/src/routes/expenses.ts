import { Router } from 'express';
import { query, pool } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { broadcastToGroup } from '../services/websocket';

const router = Router();
router.use(requireAuth);

// POST /api/expenses — create expense with splits
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { groupId, description, amount, splitMethod, paidBy, splits, memberIds, date, categoryId } = req.body;

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
      `INSERT INTO expenses (group_id, paid_by, description, amount, split_method, expense_date, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [groupId, payerId, description, numAmount, splitMethod || 'equal', date || new Date(), categoryId || null]
    );

    const expenseId = expenseResult.rows[0].id;

    if (splitMethod === 'equal' || !splitMethod) {
      let membersToDivide: number[];
      if (Array.isArray(memberIds) && memberIds.length > 0) {
        membersToDivide = memberIds;
      } else {
        const members = await query(
          'SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY user_id',
          [groupId]
        );
        membersToDivide = members.rows.map((r: any) => r.user_id);
      }

      const memberCount = membersToDivide.length;
      const baseShare = Math.floor((numAmount * 100) / memberCount) / 100;
      const remainder = Math.round((numAmount - baseShare * memberCount) * 100) / 100;

      for (let i = 0; i < memberCount; i++) {
        const shareAmount = i === 0 ? baseShare + remainder : baseShare;
        await query(
          'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
          [expenseId, membersToDivide[i], shareAmount]
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
    } else if (splitMethod === 'percentage' && Array.isArray(splits)) {
      for (const split of splits) {
        if (!split.userId || !split.amount) continue;
        await query(
          'INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)',
          [expenseId, split.userId, parseFloat(split.amount), split.percentage != null ? parseFloat(split.percentage) : null]
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

    // Broadcast real-time update
    broadcastToGroup(groupId, { type: 'expense_created', data: { expenseId } });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/expenses?groupId=X — list expenses + payments (full transaction history)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'groupId query parameter is required' });
    }

    // Fetch expenses with splits and category info
    const expenseResult = await query(
      `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email,
              c.id AS category_id, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.group_id = $1
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [groupId]
    );

    const expenses = await Promise.all(
      expenseResult.rows.map(async (expense) => {
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
          type: 'expense',
          amount: parseFloat(expense.amount),
          splits: splitsResult.rows.map((s: any) => ({
            ...s,
            amount: parseFloat(s.amount),
          })),
        };
      })
    );

    // Fetch payments (settle-ups) as transaction history too
    const paymentResult = await query(
      `SELECT p.*, fu.name AS from_name, tu.name AS to_name
       FROM payments p
       JOIN users fu ON fu.id = p.from_user
       JOIN users tu ON tu.id = p.to_user
       WHERE p.group_id = $1
       ORDER BY p.date DESC, p.created_at DESC`,
      [groupId]
    );

    const payments = paymentResult.rows.map((p: any) => ({
      id: p.id,
      group_id: p.group_id,
      type: 'payment',
      description: `${p.from_name} paid ${p.to_name}`,
      paid_by: p.from_user,
      paid_by_name: p.from_name,
      amount: parseFloat(p.amount),
      expense_date: p.date,
      created_at: p.created_at,
      note: p.note,
      from_user: p.from_user,
      to_user: p.to_user,
      splits: [
        { user_id: p.from_user, name: p.from_name, amount: -parseFloat(p.amount) },
        { user_id: p.to_user, name: p.to_name, amount: parseFloat(p.amount) },
      ],
    }));

    // Merge and sort by date (newest first)
    const all = [...expenses, ...payments].sort((a, b) => {
      const dateA = new Date(a.expense_date || a.created_at).getTime();
      const dateB = new Date(b.expense_date || b.created_at).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json({ expenses: all });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/expenses/:id — get a single expense with splits
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const result = await query(
      `SELECT e.*, u.name AS paid_by_name,
              c.id AS category_id, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = $1`,
      [expenseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = result.rows[0];

    // Verify user is a group member
    const memberCheck = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [expense.group_id, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const splitsResult = await query(
      `SELECT es.*, u.name, u.email
       FROM expense_splits es
       JOIN users u ON u.id = es.user_id
       WHERE es.expense_id = $1
       ORDER BY es.id`,
      [expenseId]
    );

    res.json({
      expense: { ...expense, amount: parseFloat(expense.amount) },
      splits: splitsResult.rows.map((s: any) => ({
        ...s,
        amount: parseFloat(s.amount),
      })),
    });
  } catch (err) {
    console.error('Get expense error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/expenses/:id — update an expense (group members only)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const { description, amount, paidBy, splitMethod, splits, memberIds, date, categoryId } = req.body;

    if (!description || !amount) {
      return res.status(400).json({ error: 'description and amount are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Verify expense exists and user is a group member
    const existing = await query(
      `SELECT e.*, gm.user_id AS member_check
       FROM expenses e
       JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = $2
       WHERE e.id = $1`,
      [expenseId, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or not authorized' });
    }

    const groupId = existing.rows[0].group_id;
    const payerId = paidBy || existing.rows[0].paid_by;
    const expenseDate = date || existing.rows[0].expense_date;
    const method = splitMethod || 'equal';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update the expense row
      const updateResult = await client.query(
        `UPDATE expenses
         SET description = $1, amount = $2, paid_by = $3, split_method = $4, expense_date = $5, category_id = $6
         WHERE id = $7 RETURNING *`,
        [description, numAmount, payerId, method, expenseDate, categoryId || null, expenseId]
      );

      // 2. Delete existing splits
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [expenseId]);

      // 3. Insert new splits
      if (method === 'equal') {
        let membersToDivide: number[];
        if (Array.isArray(memberIds) && memberIds.length > 0) {
          membersToDivide = memberIds;
        } else {
          const membersResult = await client.query(
            'SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY user_id',
            [groupId]
          );
          membersToDivide = membersResult.rows.map((r: any) => r.user_id);
        }

        const memberCount = membersToDivide.length;
        const baseShare = Math.floor((numAmount * 100) / memberCount) / 100;
        const remainder = Math.round((numAmount - baseShare * memberCount) * 100) / 100;

        for (let i = 0; i < memberCount; i++) {
          const shareAmount = i === 0 ? baseShare + remainder : baseShare;
          await client.query(
            'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
            [expenseId, membersToDivide[i], shareAmount]
          );
        }
      } else if (method === 'custom' && Array.isArray(splits)) {
        for (const split of splits) {
          if (!split.userId || !split.amount) continue;
          await client.query(
            'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
            [expenseId, split.userId, parseFloat(split.amount)]
          );
        }
      } else if (method === 'percentage' && Array.isArray(splits)) {
        for (const split of splits) {
          if (!split.userId || !split.amount) continue;
          await client.query(
            'INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)',
            [expenseId, split.userId, parseFloat(split.amount), split.percentage != null ? parseFloat(split.percentage) : null]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated splits for response
      const splitsResult = await query(
        `SELECT es.*, u.name, u.email
         FROM expense_splits es
         JOIN users u ON u.id = es.user_id
         WHERE es.expense_id = $1
         ORDER BY es.id`,
        [expenseId]
      );

      res.json({
        expense: { ...updateResult.rows[0], amount: parseFloat(updateResult.rows[0].amount) },
        splits: splitsResult.rows.map((s: any) => ({ ...s, amount: parseFloat(s.amount) })),
      });

      // Broadcast real-time update
      broadcastToGroup(groupId, { type: 'expense_updated', data: { expenseId } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update expense error:', err);
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

    // Get the group_id before deleting (needed for broadcast)
    const getGroup = await query('SELECT group_id FROM expenses WHERE id = $1', [expenseId]);
    if (getGroup.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    const groupId = getGroup.rows[0].group_id;

    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND paid_by = $2 RETURNING id',
      [expenseId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or not authorized' });
    }

    res.json({ message: 'Expense deleted' });

    // Broadcast real-time update
    broadcastToGroup(groupId, { type: 'expense_deleted', data: { expenseId } });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
