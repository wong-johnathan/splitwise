import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/users/search?q= — search users by name or email
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const q = ((req.query.q as string) || '').trim();

    let result;
    if (q.length === 0) {
      result = await query(
        'SELECT id, name, email FROM users WHERE id != $1 ORDER BY created_at DESC LIMIT 10',
        [req.userId]
      );
    } else {
      result = await query(
        `SELECT id, name, email FROM users
         WHERE id != $1 AND (name ILIKE $2 OR email ILIKE $2)
         ORDER BY name ASC LIMIT 10`,
        [req.userId, `%${q}%`]
      );
    }

    res.json({ users: result.rows });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
