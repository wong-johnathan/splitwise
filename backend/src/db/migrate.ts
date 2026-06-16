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

    if (tablesExist) {
      console.log('✅ Database schema already up to date');
      return;
    }

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
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}
