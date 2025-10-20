import { Pool } from 'pg';

const LOCAL_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://akleao:akleao_dev_password@localhost:5432/akleao';
const PROD_DATABASE_URL = 'postgresql://akleao:YTmLuVfpJPuTwYiG%2FFaLUFoY5me1TYyY1UAlc7TvGUw%3D@34.44.5.181:5432/akleao';

async function syncData() {
  const localPool = new Pool({ connectionString: LOCAL_DATABASE_URL });
  const prodPool = new Pool({
    connectionString: PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Starting data sync from local to production...\n');

    // Define table order respecting foreign key dependencies
    // Parent tables must be synced before child tables that reference them
    const tablesToSync = [
      // Base tables with no dependencies
      'stocks',
      'tracked_subreddits',
      'users',

      // Tables depending on stocks
      'stock_subreddit_mappings',
      'positions',
      'user_insights',
      'news_articles',

      // Tables depending on tracked_subreddits and stocks
      'scraper_runs',
      'scraper_jobs',
      'research_reports',

      // Reddit data - posts must come before comments
      'reddit_posts',
      'reddit_comments',

      // Tables depending on reddit_posts
      'post_analyses',
      'sentiment_analyses'
    ];

    console.log(`📋 Tables to sync: ${tablesToSync.join(', ')}\n`);

    for (const table of tablesToSync) {
      try {
        console.log(`📊 Syncing ${table}...`);

        // Check if table exists in local
        const tableCheck = await localPool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
          [table]
        );

        if (!tableCheck.rows[0].exists) {
          console.log(`   ⏭️  Table ${table} doesn't exist locally, skipping`);
          continue;
        }

        // Get count from local
        const localCount = await localPool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   Local: ${localCount.rows[0].count} rows`);

        // Get count from prod
        const prodCount = await prodPool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   Prod: ${prodCount.rows[0].count} rows`);

        // Copy data (this is a simple approach - you might want to be more selective)
        if (parseInt(localCount.rows[0].count) > 0) {
          const data = await localPool.query(`SELECT * FROM ${table}`);

          if (data.rows.length > 0) {
            // Get column names
            const columns = Object.keys(data.rows[0]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            console.log(`   📝 Inserting ${data.rows.length} rows...`);

            for (const row of data.rows) {
              // Convert JSON objects to strings for proper insertion
              const values = columns.map(col => {
                const value = row[col];
                // If value is an object or array, stringify it
                if (value !== null && typeof value === 'object') {
                  return JSON.stringify(value);
                }
                return value;
              });

              try {
                await prodPool.query(
                  `INSERT INTO ${table} (${columns.join(', ')})
                   VALUES (${placeholders})
                   ON CONFLICT DO NOTHING`,
                  values
                );
              } catch (err: any) {
                // Skip individual row errors (like duplicates)
                if (err.code !== '23505') { // unique violation
                  console.log(`     ⚠️  Error inserting row: ${err.message}`);
                }
              }
            }

            const newProdCount = await prodPool.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`   ✅ Prod now has: ${newProdCount.rows[0].count} rows\n`);
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Error syncing ${table}: ${error.message}\n`);
      }
    }

    console.log('✅ Data sync complete!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await localPool.end();
    await prodPool.end();
  }
}

syncData().catch(console.error);
