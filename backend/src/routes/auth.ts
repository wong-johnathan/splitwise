import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/pool';
import { signToken } from '../services/auth';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { config } from '../config';

const router = Router();

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

// POST /api/auth/google — authenticate with Google ID token
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const avatarUrl = payload.picture || null;

    // Upsert user: find by google_id, or create new
    let existing = await query('SELECT id, email, name, avatar_url FROM users WHERE google_id = $1', [googleId]);

    let user;
    if (existing.rows.length > 0) {
      // Update name/avatar in case they changed
      const updateResult = await query(
        `UPDATE users SET name = $1, avatar_url = COALESCE($2, avatar_url), email = $3
         WHERE google_id = $4 RETURNING id, email, name, avatar_url, created_at`,
        [name, avatarUrl, email, googleId]
      );
      user = updateResult.rows[0];
    } else {
      // Create new user
      const createResult = await query(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET google_id = $4, name = $2, avatar_url = COALESCE($3, users.avatar_url)
         RETURNING id, email, name, avatar_url, created_at`,
        [email, name, avatarUrl, googleId]
      );
      user = createResult.rows[0];
    }

    const token = signToken(user.id);

    res.json({ user, token });
  } catch (err: any) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// GET /api/auth/me — get current user profile (protected)
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
