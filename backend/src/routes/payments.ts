import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { broadcastToGroup } from '../services/websocket';
import { logActivity } from '../services/activity-log';

const router = Router();
router.use(requireAuth);

// POST /api/payments — record a settlement payment (reduces the amount owed)
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { groupId, toUser, amount, note, date, fromUser } = req.body;

    if (!groupId || !toUser || !amount) {
      return res.status(400).json({ error: 'groupId, toUser, and amount are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // fromUser defaults to current user, but can be set to record someone else paying
    const payer = fromUser || req.userId;

    // Verify both users are group members
    const memberCheck = await query(
      `SELECT 1 FROM group_members
       WHERE group_id = $1 AND user_id IN ($2, $3)
       GROUP BY group_id
       HAVING COUNT(*) = 2`,
      [groupId, payer, toUser]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Both users must be group members' });
    }

    // Use provided date or default to now
    const paymentDate = date || new Date().toISOString();

    const result = await query(
      `INSERT INTO payments (group_id, from_user, to_user, amount, note, date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [groupId, payer, toUser, numAmount, note || null, paymentDate]
    );

    const payment = result.rows[0];
    payment.amount = parseFloat(payment.amount);

    res.status(201).json({ payment });

    // Broadcast real-time update
    broadcastToGroup(groupId, { type: 'payment_created', data: { paymentId: payment.id } });

    // Log activity
    logActivity({
      groupId, actorId: req.userId!, actionType: 'created', entityType: 'payment',
      entityId: payment.id,
      description: `recorded a settlement ($${numAmount.toFixed(2)})`,
      metadata: { fromUser: payer, toUser, amount: numAmount, note: note || null },
    }).catch(console.error);
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

// DELETE /api/payments/:id — delete a payment (only involved users can delete)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    // Get the group_id before deleting (needed for broadcast)
    const getGroup = await query('SELECT group_id FROM payments WHERE id = $1', [paymentId]);
    if (getGroup.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const groupId = getGroup.rows[0].group_id;

    // Fetch full payment data for activity logging
    const paymentData = await query(
      'SELECT p.*, fu.name AS from_name, tu.name AS to_name FROM payments p JOIN users fu ON fu.id = p.from_user JOIN users tu ON tu.id = p.to_user WHERE p.id = $1',
      [paymentId]
    );
    const payment = paymentData.rows[0];

    const result = await query(
      'DELETE FROM payments WHERE id = $1 RETURNING id',
      [paymentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found or not authorized' });
    }

    res.json({ message: 'Payment deleted' });

    // Broadcast real-time update
    broadcastToGroup(groupId, { type: 'payment_deleted', data: { paymentId } });

    // Log activity
    logActivity({
      groupId: payment.group_id, actorId: req.userId!, actionType: 'deleted',
      entityType: 'payment', entityId: paymentId,
      description: `deleted a settlement ($${parseFloat(payment.amount).toFixed(2)}) from ${payment.from_name} to ${payment.to_name}`,
      metadata: { fromUser: payment.from_user, toUser: payment.to_user, amount: parseFloat(payment.amount) },
    }).catch(console.error);
  } catch (err) {
    console.error('Delete payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/payments/:id — update a payment (amount, note, date)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const { amount, note, date } = req.body;

    // Verify payment exists and user is involved
    const existing = await query(
      `SELECT * FROM payments WHERE id = $1`,
      [paymentId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = existing.rows[0];
    const groupId = payment.group_id;

    const numAmount = amount !== undefined ? parseFloat(amount) : payment.amount;
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const updatedNote = note !== undefined ? (note || null) : payment.note;
    const updatedDate = date || payment.date;

    const result = await query(
      `UPDATE payments SET amount = $1, note = $2, date = $3 WHERE id = $4 RETURNING *`,
      [numAmount, updatedNote, updatedDate, paymentId]
    );

    const updated = result.rows[0];
    updated.amount = parseFloat(updated.amount);

    res.json({ payment: updated });

    // Broadcast real-time update
    broadcastToGroup(payment.group_id, { type: 'payment_updated', data: { paymentId } });

    // Log activity
    const oldAmount = parseFloat(payment.amount);
    const descParts: string[] = [];
    if (Math.abs(oldAmount - numAmount) > 0.001) descParts.push(`amount $${oldAmount.toFixed(2)} → $${numAmount.toFixed(2)}`);
    const updateDesc = descParts.length > 0 ? `updated a settlement (${descParts.join(', ')})` : 'updated a settlement';
    logActivity({
      groupId: payment.group_id, actorId: req.userId!, actionType: 'updated',
      entityType: 'payment', entityId: paymentId,
      description: updateDesc,
      metadata: { old: { amount: parseFloat(payment.amount) }, new: { amount: numAmount } },
    }).catch(console.error);
  } catch (err) {
    console.error('Update payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
