import { pool } from './pool';
import fs from 'fs';
import path from 'path';

export async function runMigrations() {
  try {
    // Check if tables already exist
    const { rows } = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')"
    );
    const tablesExist = rows[0].exists;

    if (!tablesExist) {
      // Try to find init.sql — works both when running from src/ (tsx) and dist/
      const possiblePaths = [
        path.resolve(__dirname, '../migrations/init.sql'),       // dist/db/ → dist/migrations/
        path.resolve(__dirname, '../db/migrations/init.sql'),    // dist/ → dist/db/migrations/
        path.resolve(__dirname, '../../src/db/migrations/init.sql'), // dist/db/ → src/db/migrations/
        path.resolve(__dirname, '../src/db/migrations/init.sql'),    // dist/ → src/db/migrations/
      ];

      let sqlPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          sqlPath = p;
          break;
        }
      }

      if (!sqlPath) {
        throw new Error(
          `Cannot find init.sql. Tried:\n${possiblePaths.join('\n')}`
        );
      }

      console.log(`⏳ Running database migrations from ${sqlPath}...`);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      await pool.query(sql);
      console.log('✅ Database migrations complete');
    } else {
      console.log('✅ Database schema already up to date');
    }

    // Incremental migrations (idempotent — safe to run every startup)

    // Add 'percentage' to split_method enum if not present
    const enumCheck = await pool.query(`
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'percentage'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'split_method')
    `);
    if (enumCheck.rows.length === 0) {
      await pool.query("ALTER TYPE split_method ADD VALUE 'percentage'");
      console.log("✅ Added 'percentage' to split_method enum");
    }

    // Add percentage column to expense_splits if not present
    const colCheck = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'expense_splits' AND column_name = 'percentage'
    `);
    if (colCheck.rows.length === 0) {
      await pool.query('ALTER TABLE expense_splits ADD COLUMN percentage DECIMAL(5,2)');
      console.log('✅ Added percentage column to expense_splits');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }

  // ✅ Categories migration (002)
  try {
    const categoryTableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'categories'
    `);
    if (categoryTableCheck.rows.length === 0) {
      const possiblePaths = [
        path.resolve(__dirname, '../migrations/002_categories.sql'),
        path.resolve(__dirname, '../db/migrations/002_categories.sql'),
        path.resolve(__dirname, '../../src/db/migrations/002_categories.sql'),
        path.resolve(__dirname, '../src/db/migrations/002_categories.sql'),
      ];
      let sqlPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { sqlPath = p; break; }
      }
      if (sqlPath) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        console.log('✅ Categories migration complete');
      }
    } else {
      // Ensure category_id column exists on expenses (for idempotent reruns)
      const colCheck2 = await pool.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'expenses' AND column_name = 'category_id'
      `);
      if (colCheck2.rows.length === 0) {
        await pool.query('ALTER TABLE expenses ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL');
        console.log('✅ Added category_id to expenses');
      }

      // Also ensure FK index exists
      const idxCheck = await pool.query(`
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_expenses_category'
      `);
      if (idxCheck.rows.length === 0) {
        await pool.query('CREATE INDEX idx_expenses_category ON expenses(category_id)');
      }
    }
  } catch (err) {
    console.error('❌ Categories migration failed:', err);
  }

  // ✅ Google OAuth migration (003)
  try {
    const googleIdCheck = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'google_id'
    `);
    if (googleIdCheck.rows.length === 0) {
      const possiblePaths = [
        path.resolve(__dirname, '../migrations/003_google_oauth.sql'),
        path.resolve(__dirname, '../db/migrations/003_google_oauth.sql'),
        path.resolve(__dirname, '../../src/db/migrations/003_google_oauth.sql'),
        path.resolve(__dirname, '../src/db/migrations/003_google_oauth.sql'),
      ];
      let sqlPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { sqlPath = p; break; }
      }
      if (sqlPath) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        console.log('✅ Google OAuth migration complete');
      }
    }
  } catch (err) {
    console.error('❌ Google OAuth migration failed:', err);
  }

  // ✅ Expense date → TIMESTAMPTZ so users can enter precise datetime
  try {
    const dateTypeCheck = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'expense_date'
    `);
    if (dateTypeCheck.rows.length > 0 && dateTypeCheck.rows[0].data_type === 'date') {
      await pool.query('ALTER TABLE expenses ALTER COLUMN expense_date TYPE TIMESTAMPTZ USING expense_date::timestamptz');
      console.log("✅ Changed expense_date from DATE to TIMESTAMPTZ");
    }
  } catch (err) {
    console.error('❌ expense_date migration failed:', err);
  }

  // ✅ Payment date → TIMESTAMPTZ so users can enter precise datetime
  try {
    const payDateTypeCheck = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'date'
    `);
    if (payDateTypeCheck.rows.length > 0 && payDateTypeCheck.rows[0].data_type === 'date') {
      await pool.query('ALTER TABLE payments ALTER COLUMN date TYPE TIMESTAMPTZ USING date::timestamptz');
      console.log("✅ Changed payments.date from DATE to TIMESTAMPTZ");
    }
  } catch (err) {
    console.error('❌ payments.date migration failed:', err);
  }

  // ✅ Activity logs migration (004)
  try {
    const activityLogsCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs'
    `);
    if (activityLogsCheck.rows.length === 0) {
      const possiblePaths = [
        path.resolve(__dirname, '../migrations/004_activity_logs.sql'),
        path.resolve(__dirname, '../db/migrations/004_activity_logs.sql'),
        path.resolve(__dirname, '../../src/db/migrations/004_activity_logs.sql'),
        path.resolve(__dirname, '../src/db/migrations/004_activity_logs.sql'),
      ];
      let sqlPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { sqlPath = p; break; }
      }
      if (sqlPath) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        console.log('✅ Activity logs migration complete');
      }
    }
  } catch (err) {
    console.error('❌ Activity logs migration failed:', err);
  }

  // ✅ Multi-currency migration (005)
  try {
    // Check if base_currency column exists on groups
    const mcCheck = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'groups' AND column_name = 'base_currency'
    `);
    if (mcCheck.rows.length === 0) {
      const possiblePaths = [
        path.resolve(__dirname, '../migrations/005_multi_currency.sql'),
        path.resolve(__dirname, '../db/migrations/005_multi_currency.sql'),
        path.resolve(__dirname, '../../src/db/migrations/005_multi_currency.sql'),
        path.resolve(__dirname, '../src/db/migrations/005_multi_currency.sql'),
      ];
      let sqlPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { sqlPath = p; break; }
      }
      if (sqlPath) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        console.log('✅ Multi-currency migration complete');
      }
    } else {
      // Idempotent: ensure columns exist (re-run safe)
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'SGD'`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_in_base DECIMAL(12,2)`);
      await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(12,6) DEFAULT 1`);
      await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'SGD'`);
      await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_in_base DECIMAL(12,2)`);
      await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(12,6) DEFAULT 1`);
      await pool.query(`UPDATE expenses SET amount_in_base = amount, fx_rate = 1 WHERE amount_in_base IS NULL`);
      await pool.query(`UPDATE payments SET amount_in_base = amount, fx_rate = 1 WHERE amount_in_base IS NULL`);
      // Create cached_rates table if not exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cached_rates (
          id SERIAL PRIMARY KEY,
          base_currency VARCHAR(3) NOT NULL,
          target_currency VARCHAR(3) NOT NULL,
          rate DECIMAL(12,6) NOT NULL,
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(base_currency, target_currency)
        )
      `);
      console.log('✅ Multi-currency columns verified');
    }
  } catch (err) {
    console.error('❌ Multi-currency migration failed:', err);
  }
}
