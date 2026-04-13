const { config } = require('dotenv');
config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const { db } = require('./src/lib/db/index.ts');
  const { sql } = require('drizzle-orm');
  const { vwDailySalesMetrics } = require('./src/lib/db/schema.ts');

  const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);
  
  console.log("Raw SQL MAX:", latestRes[0].latestDate);
}

main().catch(console.error);
