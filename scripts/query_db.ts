import { db } from '../src/lib/db';
import { dailyConsolidatedMetrics } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkData() {
  const data = await db.select().from(dailyConsolidatedMetrics)
    .where(sql`"BusinessDate" = '2026-05-26' AND "StoreId" = 1`);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

checkData();
