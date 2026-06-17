-- Categories for expense classification
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, name)
);

-- Add category_id to expenses (nullable)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
