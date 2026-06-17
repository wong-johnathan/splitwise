-- 005_multi_currency.sql
-- Adds multi-currency support: groups can set a base currency,
-- expenses/payments can be in any currency with FX rate tracking.

-- Groups: add base currency and multi-currency toggle
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  ADD COLUMN IF NOT EXISTS multi_currency BOOLEAN NOT NULL DEFAULT false;

-- Expenses: add currency, amount_in_base, fx_rate
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  ADD COLUMN IF NOT EXISTS amount_in_base DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(12,6) DEFAULT 1;

-- Payments: add currency, amount_in_base, fx_rate
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  ADD COLUMN IF NOT EXISTS amount_in_base DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(12,6) DEFAULT 1;

-- Backfill: set amount_in_base = amount, fx_rate = 1 for all existing rows
UPDATE expenses SET amount_in_base = amount, fx_rate = 1 WHERE amount_in_base IS NULL;
UPDATE payments SET amount_in_base = amount, fx_rate = 1 WHERE amount_in_base IS NULL;

-- Cached exchange rate table (avoids hitting the API on every request)
CREATE TABLE IF NOT EXISTS cached_rates (
  id SERIAL PRIMARY KEY,
  base_currency VARCHAR(3) NOT NULL,
  target_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(12,6) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(base_currency, target_currency)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_cached_rates_pair ON cached_rates(base_currency, target_currency);

-- Indexes for new expense/payment columns
CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency);
CREATE INDEX IF NOT EXISTS idx_payments_currency ON payments(currency);
