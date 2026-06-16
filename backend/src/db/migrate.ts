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

    console.log('⏳ Running database migrations...');
    const sqlPath = path.resolve(__dirname, '../migrations/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    await pool.query(sql);
    console.log('✅ Database migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}
