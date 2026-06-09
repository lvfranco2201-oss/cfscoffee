import { db } from '../src/lib/db';
import { sql as drizzleSql } from 'drizzle-orm';

async function run() {
  console.log('Dropping table DailyConsolidatedMetricsRealtime if exists...');
  await db.execute(drizzleSql`DROP TABLE IF EXISTS "DailyConsolidatedMetricsRealtime" CASCADE;`);
  
  console.log('Creating table DailyConsolidatedMetricsRealtime by cloning DailyConsolidatedMetrics...');
  await db.execute(drizzleSql`
    CREATE TABLE "DailyConsolidatedMetricsRealtime" (LIKE "DailyConsolidatedMetrics" INCLUDING ALL);
  `);
  console.log('Table created successfully.');

  console.log('Creating view vw_RealtimeConsolidatedMetrics...');
  await db.execute(drizzleSql`
    CREATE OR REPLACE VIEW "vw_RealtimeConsolidatedMetrics" AS
    SELECT * FROM "DailyConsolidatedMetrics" 
    WHERE "BusinessDate" NOT IN (SELECT DISTINCT "BusinessDate" FROM "DailyConsolidatedMetricsRealtime")
    UNION ALL
    SELECT * FROM "DailyConsolidatedMetricsRealtime";
  `);
  console.log('View created successfully.');
  process.exit(0);
}

run().catch(console.error);
