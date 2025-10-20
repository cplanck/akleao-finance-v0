import { Pool } from 'pg';

const PROD_DATABASE_URL = 'postgresql://akleao:YTmLuVfpJPuTwYiG%2FFaLUFoY5me1TYyY1UAlc7TvGUw%3D@34.44.5.181:5432/akleao';

async function createMissingTables() {
  const pool = new Pool({
    connectionString: PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📥 Connecting to production database...\n');

    // Create pinned_stocks table
    console.log('Creating pinned_stocks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pinned_stocks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        pinned_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, symbol)
      );
    `);
    console.log('✅ pinned_stocks table created\n');

    // Create user_api_keys table
    console.log('Creating user_api_keys table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        encrypted_key TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        UNIQUE(user_id)
      );
    `);
    console.log('✅ user_api_keys table created\n');

    // Create openai_usage table
    console.log('Creating openai_usage table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS openai_usage (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        request_type VARCHAR(50) NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        cost_usd DECIMAL(10, 6) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ openai_usage table created\n');

    // Create indexes
    console.log('Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pinned_stocks_user_id ON pinned_stocks(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_openai_usage_user_id ON openai_usage(user_id);
      CREATE INDEX IF NOT EXISTS idx_openai_usage_created_at ON openai_usage(created_at);
    `);
    console.log('✅ Indexes created\n');

    console.log('✅ All missing tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createMissingTables().catch(console.error);
