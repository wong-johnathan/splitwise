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
}
