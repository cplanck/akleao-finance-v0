import { Pool } from 'pg';
import { readFileSync } from 'fs';

const PROD_DATABASE_URL = 'postgresql://akleao:YTmLuVfpJPuTwYiG%2FFaLUFoY5me1TYyY1UAlc7TvGUw%3D@34.44.5.181:5432/akleao';

async function importSchema() {
  const pool = new Pool({
    connectionString: PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📥 Connecting to production database...\n');

    // Read the schema SQL file
    const schema = readFileSync('/tmp/prod-schema-app-only.sql', 'utf8');

    console.log('📝 Importing schema...\n');

    // Remove psql-specific commands that don't work with node-postgres
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('\\'))
      .join('\n');

    // Execute the schema
    await pool.query(cleanedSchema);

    console.log('✅ Schema imported successfully!\n');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name NOT IN ('user', 'session', 'account', 'verification', 'alembic_version')
      ORDER BY table_name;
    `);

    console.log(`📋 Application tables in production (${result.rows.length}):`);
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

importSchema().catch(console.error);
