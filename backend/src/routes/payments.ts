import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// POST /api/payments — record a settlement payment
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { groupId, toUser, amount, note } = req.body;

    if (!groupId || !toUser || !amount) {
      return res.status(400).json({ error: 'groupId, toUser, and amount are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Verify both users are group members
    const memberCheck = await query(
      `SELECT 1 FROM group_members
       WHERE group_id = $1 AND user_id IN ($2, $3)
       GROUP BY group_id
       HAVING COUNT(*) = 2`,
      [groupId, req.userId, toUser]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Both users must be group members' });
    }

    const result = await query(
      `INSERT INTO payments (group_id, from_user, to_user, amount, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [groupId, req.userId, toUser, numAmount, note || null]
    );

    const payment = result.rows[0];
    payment.amount = parseFloat(payment.amount);

    res.status(201).json({ payment });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments?groupId=X — list payment history for a group
router.get('/', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'groupId query parameter is required' });
    }

    const result = await query(
      `SELECT p.*, fu.name AS from_name, fu.email AS from_email, tu.name AS to_name, tu.email AS to_email
       FROM payments p
       JOIN users fu ON fu.id = p.from_user
       JOIN users tu ON tu.id = p.to_user
       WHERE p.group_id = $1
       ORDER BY p.date DESC, p.created_at DESC`,
      [groupId]
    );

    const payments = result.rows.map((p: any) => ({
      ...p,
      amount: parseFloat(p.amount),
    }));

    res.json({ payments });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
