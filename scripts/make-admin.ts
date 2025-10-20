import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://akleao:YTmLuVfpJPuTwYiG%2FFaLUFoY5me1TYyY1UAlc7TvGUw%3D@34.44.5.181:5432/akleao';

async function makeAdmin() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to production database...');

    // First, let's see what users exist
    const users = await pool.query('SELECT id, email, name, role FROM "user"');
    console.log('\nCurrent users:');
    users.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.name}) - role: ${user.role}`);
    });

    if (users.rows.length === 0) {
      console.log('\n❌ No users found. Please log in to the app first to create your user account.');
      return;
    }

    // Update the first user (or specify an email)
    const emailToMakeAdmin = process.argv[2] || users.rows[0].email;

    console.log(`\n📝 Making ${emailToMakeAdmin} an admin...`);

    const result = await pool.query(
      'UPDATE "user" SET role = $1 WHERE email = $2 RETURNING email, role',
      ['admin', emailToMakeAdmin]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Successfully updated ${result.rows[0].email} to role: ${result.rows[0].role}`);
    } else {
      console.log(`❌ User with email ${emailToMakeAdmin} not found`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

makeAdmin().catch(console.error);
