import { pool } from './pool';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create demo users (no password — Google OAuth only)
  // Alice
  const alice = await pool.query(
    `INSERT INTO users (email, name) VALUES ('alice@test.com', 'Alice')
     ON CONFLICT (email) DO UPDATE SET name = 'Alice' RETURNING id`,
  );
  const aliceId = alice.rows[0].id;

  // Bob
  const bob = await pool.query(
    `INSERT INTO users (email, name) VALUES ('bob@test.com', 'Bob')
     ON CONFLICT (email) DO UPDATE SET name = 'Bob' RETURNING id`,
  );
  const bobId = bob.rows[0].id;

  // Charlie
  const charlie = await pool.query(
    `INSERT INTO users (email, name) VALUES ('charlie@test.com', 'Charlie')
     ON CONFLICT (email) DO UPDATE SET name = 'Charlie' RETURNING id`,
  );
  const charlieId = charlie.rows[0].id;

  console.log(`  Users: Alice (${aliceId}), Bob (${bobId}), Charlie (${charlieId})`);

  // Create group - Trip to Bali
  const group = await pool.query(
    `INSERT INTO groups (name, description, created_by) VALUES ('Trip to Bali', 'Bali trip in June 2025', $1)
     ON CONFLICT DO NOTHING RETURNING id`,
    [aliceId]
  );

  let groupId: number;
  if (group.rows.length > 0) {
    groupId = group.rows[0].id;
  } else {
    const existing = await pool.query("SELECT id FROM groups WHERE name = 'Trip to Bali'");
    groupId = existing.rows[0].id;
  }

  // Add members
  await pool.query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2), ($1, $3), ($1, $4) ON CONFLICT DO NOTHING',
    [groupId, aliceId, bobId, charlieId]
  );

  console.log(`  Group: Trip to Bali (${groupId}) -- 3 members`);

  // Seed default categories for the group
  const defaultCategories = [
    { name: 'Food', color: '#EF4444', icon: '🍽️' },
    { name: 'Transport', color: '#3B82F6', icon: '🚗' },
    { name: 'Hotel', color: '#8B5CF6', icon: '🏨' },
    { name: 'Shopping', color: '#EC4899', icon: '🛍️' },
    { name: 'Utilities', color: '#F59E0B', icon: '💡' },
    { name: 'Entertainment', color: '#10B981', icon: '🎬' },
    { name: 'Health', color: '#14B8A6', icon: '💊' },
    { name: 'Other', color: '#6B7280', icon: '📦' },
  ];
  for (const cat of defaultCategories) {
    await pool.query(
      `INSERT INTO categories (group_id, name, color, icon)
       VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, name) DO NOTHING`,
      [groupId, cat.name, cat.color, cat.icon]
    );
  }
  console.log('  Categories: 8 defaults seeded');

  // Create expenses
  const exp1 = await pool.query(
    `INSERT INTO expenses (group_id, paid_by, description, amount, split_method, expense_date)
     VALUES ($1, $2, 'Dinner at beach club', 60, 'equal', '2025-06-10') RETURNING id`,
    [groupId, aliceId]
  );
  const exp1Id = exp1.rows[0].id;
  await pool.query(
    'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, 20), ($1, $3, 20), ($1, $4, 20)',
    [exp1Id, aliceId, bobId, charlieId]
  );

  const exp2 = await pool.query(
    `INSERT INTO expenses (group_id, paid_by, description, amount, split_method, expense_date)
     VALUES ($1, $2, 'Taxi to airport', 30, 'equal', '2025-06-09') RETURNING id`,
    [groupId, bobId]
  );
  const exp2Id = exp2.rows[0].id;
  await pool.query(
    'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, 10), ($1, $3, 10), ($1, $4, 10)',
    [exp2Id, bobId, aliceId, charlieId]
  );

  const exp3 = await pool.query(
    `INSERT INTO expenses (group_id, paid_by, description, amount, split_method, expense_date)
     VALUES ($1, $2, 'Hotel booking', 150, 'equal', '2025-06-11') RETURNING id`,
    [groupId, charlieId]
  );
  const exp3Id = exp3.rows[0].id;
  await pool.query(
    'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, 50), ($1, $3, 50), ($1, $4, 50)',
    [exp3Id, charlieId, aliceId, bobId]
  );

  console.log('  Expenses: Dinner ($60), Taxi ($30), Hotel ($150)');

  console.log('');
  console.log('✅ Seed completed!');
  console.log('');
  console.log('📧 Test users:');
  console.log('   alice@test.com, bob@test.com, charlie@test.com');
  console.log('   (log in with Google using the same email)');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
