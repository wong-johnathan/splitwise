import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { simplifyDebts } from '../services/balance';
import { seedDefaultCategories } from './categories';

const router = Router();
router.use(requireAuth);

// POST /api/groups — create a new group
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, memberIds } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const result = await query(
      'INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description || null, req.userId]
    );

    const groupId = result.rows[0].id;

    // Add creator as member
    await query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [groupId, req.userId]
    );

    // Add invited members (if provided)
    if (Array.isArray(memberIds)) {
      const uniqueIds = [...new Set(memberIds.map(Number).filter((id) => id !== req.userId && !isNaN(id)))];
      for (const uid of uniqueIds) {
        await query(
          'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [groupId, uid]
        );
      }
    }

    // Seed default categories
    await seedDefaultCategories(groupId);

    res.status(201).json({ group: result.rows[0] });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/groups — list current user's groups
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT g.*, 
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count,
        u.name AS created_by_name
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users u ON u.id = g.created_by
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.userId]
    );

    // Compute user's balance per group
    const groupsWithBalance = await Promise.all(
      result.rows.map(async (group) => {
        const balanceResult = await query(
          `SELECT
            COALESCE((SELECT SUM(amount) FROM expenses WHERE paid_by = $1 AND group_id = $2), 0) -
            COALESCE((SELECT SUM(es.amount) FROM expense_splits es JOIN expenses e ON e.id = es.expense_id WHERE es.user_id = $1 AND e.group_id = $2), 0) +
            COALESCE((SELECT SUM(amount) FROM payments WHERE from_user = $1 AND group_id = $2), 0) -
            COALESCE((SELECT SUM(amount) FROM payments WHERE to_user = $1 AND group_id = $2), 0)
          AS balance`,
          [req.userId, group.id]
        );
        return {
          ...group,
          balance: parseFloat(balanceResult.rows[0]?.balance || '0'),
        };
      })
    );

    res.json({ groups: groupsWithBalance });
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/groups/:id — group detail with members, balances, and debts
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Get group
    const groupResult = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get members
    const membersResult = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    // Compute per-user balances (expenses - splits + payments sent - payments received)
    const balanceResult = await query(
      `SELECT
        u.id,
        u.name,
        COALESCE(paid.total_paid, 0) - COALESCE(owed.total_owed, 0)
        + COALESCE(sent.total_sent, 0) - COALESCE(received.total_received, 0) AS net_balance
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      LEFT JOIN (
        SELECT paid_by AS user_id, SUM(amount) AS total_paid
        FROM expenses WHERE group_id = $1 GROUP BY paid_by
      ) paid ON paid.user_id = u.id
      LEFT JOIN (
        SELECT es.user_id, SUM(es.amount) AS total_owed
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = $1
        GROUP BY es.user_id
      ) owed ON owed.user_id = u.id
      LEFT JOIN (
        SELECT from_user AS user_id, SUM(amount) AS total_sent
        FROM payments WHERE group_id = $1 GROUP BY from_user
      ) sent ON sent.user_id = u.id
      LEFT JOIN (
        SELECT to_user AS user_id, SUM(amount) AS total_received
        FROM payments WHERE group_id = $1 GROUP BY to_user
      ) received ON received.user_id = u.id
      WHERE gm.group_id = $1`,
      [groupId]
    );

    const balances = balanceResult.rows.map((b) => ({
      userId: b.id,
      name: b.name,
      balance: parseFloat(b.net_balance || '0'),
    }));

    // Calculate simplified debts
    const debts = simplifyDebts(
      balances.map((b) => ({ userId: b.userId, balance: b.balance }))
    );

    // Enrich debts with names
    const debtsWithNames = debts.map((d) => {
      const fromUser = membersResult.rows.find((m: any) => m.id === d.fromUser);
      const toUser = membersResult.rows.find((m: any) => m.id === d.toUser);
      return {
        fromUser: d.fromUser,
        fromUserName: fromUser?.name || 'Unknown',
        toUser: d.toUser,
        toUserName: toUser?.name || 'Unknown',
        amount: d.amount,
      };
    });

    res.json({
      group: groupResult.rows[0],
      members: membersResult.rows,
      balances,
      debts: debtsWithNames,
    });
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/groups/:id/members — add a member to a group
router.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const { userId } = req.body;
    if (!userId || typeof userId !== 'number') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const groupResult = await query('SELECT id FROM groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const memberCheck = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const userResult = await query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [groupId, userId]
    );

    res.status(201).json({ member: userResult.rows[0] });
  } catch (err) {
    console.error('Add group member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/groups/:id — delete a group (only creator can delete)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const result = await query(
      'DELETE FROM groups WHERE id = $1 AND created_by = $2 RETURNING id',
      [groupId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found or not authorized' });
    }

    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

