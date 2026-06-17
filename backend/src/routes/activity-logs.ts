import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'groupId query parameter is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const memberCheck = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const result = await query(
      `SELECT al.*, u.name AS actor_name
       FROM activity_logs al
       JOIN users u ON u.id = al.actor_id
       WHERE al.group_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [groupId, limit]
    );

    res.json({ activityLogs: result.rows });
  } catch (err) {
    console.error('List activity logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
