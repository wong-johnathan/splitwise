-- Initial schema for SplitEasy
-- This file runs automatically via docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GROUPS
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GROUP MEMBERS
CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- EXPENSES
CREATE TYPE split_method AS ENUM ('equal', 'custom', 'percentage');

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by INTEGER NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD',
  split_method split_method DEFAULT 'equal',
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXPENSE SPLITS
CREATE TABLE expense_splits (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  percentage DECIMAL(5,2),
  settled BOOLEAN DEFAULT FALSE,
  UNIQUE(expense_id, user_id)
);

-- PAYMENTS (settle-ups)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user INTEGER NOT NULL REFERENCES users(id),
  to_user INTEGER NOT NULL REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_expenses_group ON expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX idx_payments_group ON payments(group_id);
