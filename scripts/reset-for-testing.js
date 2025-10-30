// Reset database for manual testing: remove all data, keep super-admin and one owner
// Creates/updates default accounts:
//  - superadmin@test.com / admin123 (role: super-admin)
//  - owner@test.com / password123 (role: owner)

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function reset() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  const client = await pool.connect();
  try {
    console.log('🚧 Starting reset transaction...');
    await client.query('BEGIN');

    // Ensure tables exist; if not, let errors bubble
    const q = (text, params) => client.query(text, params);

    // Ensure UUID function exists (best-effort)
    try { await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto'); } catch {}

    // Child tables first
    await q('DELETE FROM assignment_users');
    await q('DELETE FROM test_attempts');
    await q('DELETE FROM progress');
    await q('DELETE FROM subscriptions');
    await q('DELETE FROM subscription_plans');
    await q('DELETE FROM usage');
    await q('DELETE FROM assignments');
    await q('DELETE FROM user_group_members');
    await q('DELETE FROM user_groups');
    await q('DELETE FROM tests');
    await q('DELETE FROM questions');
    await q('DELETE FROM documents');
    await q('DELETE FROM sections');
    await q('DELETE FROM module_versions');
    await q('DELETE FROM modules');

    // Auth-related tables
    // Keep only entries for the users we will preserve later
    // We'll clear and recreate users, so drop these entirely
    await q('DELETE FROM verification_tokens');
    await q('DELETE FROM sessions');
    await q('DELETE FROM accounts');

    // Determine owner to keep (if any exists already)
    const { rows: ownerRows } = await q(
      'SELECT id FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1',
      ['owner']
    );
    const ownerToKeep = ownerRows[0]?.id || null;

    // Delete users except super-admins and one owner (if present)
    if (ownerToKeep) {
      await q(
        'DELETE FROM users WHERE (role NOT IN ($1,$2)) OR (role = $2 AND id <> $3)',
        ['super-admin', 'owner', ownerToKeep]
      );
    } else {
      await q('DELETE FROM users WHERE role <> $1', ['super-admin']);
    }

    // Helper to get a UUID (prefers DB fn, falls back to Node)
    async function getUuid() {
      try { const r = await q('SELECT gen_random_uuid() as id'); return r.rows[0].id; } catch { return randomUUID(); }
    }

    // Upsert default super-admin
    const superEmail = 'superadmin@test.com';
    const superPass = await bcrypt.hash('admin123', 12);
    const superId = await getUuid();
    await q(
      `INSERT INTO users (id, email, name, role, password, created_at, updated_at)
       VALUES ($4, $1, $2, 'super-admin', $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET role = 'super-admin', password = EXCLUDED.password, name = EXCLUDED.name, updated_at = NOW()`,
      [superEmail, 'Super Admin', superPass, superId]
    );

    // Ensure single owner exists
    const ownerEmail = 'owner@test.com';
    const ownerPass = await bcrypt.hash('password123', 12);
    const ownerId = await getUuid();
    await q(
      `INSERT INTO users (id, email, name, role, password, created_at, updated_at)
       VALUES ($4, $1, $2, 'owner', $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET role = 'owner', password = EXCLUDED.password, name = EXCLUDED.name, updated_at = NOW()`,
      [ownerEmail, 'Test Owner', ownerPass, ownerId]
    );

    await client.query('COMMIT');
    console.log('✅ Reset complete.');
    console.log('   Super Admin: superadmin@test.com / admin123');
    console.log('   Owner:       owner@test.com / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Reset failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();


