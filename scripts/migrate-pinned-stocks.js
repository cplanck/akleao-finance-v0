const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Creating pinned_stocks table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pinned_stocks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        symbol VARCHAR(10) NOT NULL,
        pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        position INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, symbol),
        FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
      );
    `);

    console.log('Creating indexes...');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pinned_stocks_user_id ON pinned_stocks(user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pinned_stocks_position ON pinned_stocks(user_id, position);
    `);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate();
