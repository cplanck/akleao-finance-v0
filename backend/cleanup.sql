-- Clean up database tables
TRUNCATE scraper_runs RESTART IDENTITY CASCADE;
TRUNCATE scraper_jobs RESTART IDENTITY CASCADE;

-- Verify cleanup
SELECT 'scraper_runs' AS table_name, COUNT(*) AS count FROM scraper_runs
UNION ALL
SELECT 'scraper_jobs' AS table_name, COUNT(*) AS count FROM scraper_jobs;
