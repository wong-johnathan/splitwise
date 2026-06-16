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
