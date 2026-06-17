import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * Default category presets — seeded when categories table is created for a group.
 */
export const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#EF4444', icon: '🍽️' },
  { name: 'Transport', color: '#3B82F6', icon: '🚗' },
  { name: 'Hotel', color: '#8B5CF6', icon: '🏨' },
  { name: 'Shopping', color: '#EC4899', icon: '🛍️' },
  { name: 'Utilities', color: '#F59E0B', icon: '💡' },
  { name: 'Entertainment', color: '#10B981', icon: '🎬' },
  { name: 'Health', color: '#14B8A6', icon: '💊' },
  { name: 'Other', color: '#6B7280', icon: '📦' },
];

/**
 * Seed default categories for a group. Called when a group is created.
 */
export async function seedDefaultCategories(groupId: number) {
  for (const cat of DEFAULT_CATEGORIES) {
    await query(
      `INSERT INTO categories (group_id, name, color, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id, name) DO NOTHING`,
      [groupId, cat.name, cat.color, cat.icon]
    );
  }
}

// GET /api/categories?groupId=X — list categories for a group
router.get('/', async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'groupId query parameter is required' });
    }

    const result = await query(
      'SELECT * FROM categories WHERE group_id = $1 ORDER BY name',
      [groupId]
    );

    res.json({ categories: result.rows });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/categories — create a new custom category for a group
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { groupId, name, color, icon } = req.body;

    if (!groupId || !name || !name.trim()) {
      return res.status(400).json({ error: 'groupId and name are required' });
    }

    // Verify user is a group member
    const memberCheck = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const result = await query(
      `INSERT INTO categories (group_id, name, color, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id, name) DO NOTHING
       RETURNING *`,
      [groupId, name.trim(), color || '#6B7280', icon || null]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/categories/:id — delete a category
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const catId = parseInt(req.params.id);
    if (isNaN(catId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Verify user is a member of the group that owns the category
    const catResult = await query(
      `SELECT c.* FROM categories c
       JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = $2
       WHERE c.id = $1`,
      [catId, req.userId]
    );

    if (catResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or not authorized' });
    }

    await query('DELETE FROM categories WHERE id = $1', [catId]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
