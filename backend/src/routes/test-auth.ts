// Test-only auth endpoint — ONLY active when the special header validates
// Allows e2e tests to authenticate without Google OAuth
import { Router } from 'express';
import { query } from '../db/pool';
import { signToken } from '../services/auth';

const router = Router();
const TEST_SECRET = 'spliteasy-e2e-test-secret';

router.post('/test-login', async (req, res) => {
  try {
    const authHeader = req.headers['x-test-auth'];
    if (authHeader !== TEST_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const safeEmail = email;
    const safeName = name || email.split('@')[0];

    // Upsert user
    const result = await query(
      `INSERT INTO users (email, name, google_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = $2
       RETURNING id, email, name, avatar_url, created_at`,
      [safeEmail, safeName, `test-${safeEmail}`]
    );

    const user = result.rows[0];
    const token = signToken(user.id);
    res.json({ user, token });
  } catch (err) {
    console.error('Test auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
