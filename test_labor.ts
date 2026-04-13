import { db } from './src/lib/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  const lastBusinessDateStr = '2026-04-11';
  const query = sql`
        SELECT "storeId", SUM("laborCostHour") as "totalLaborStore"
        FROM (
          SELECT "StoreId" as "storeId", "BusinessHour", MAX("HourlyJobTotalPay") as "laborCostHour"
          FROM "HourlySalesMetrics"
          WHERE "BusinessDate"::date = ${lastBusinessDateStr}::date
          GROUP BY "StoreId", "BusinessHour"
        ) sub
        GROUP BY "storeId"
      `;
  
  const res = await db.execute(query);
  console.log(res);
}

main().catch(console.error);
