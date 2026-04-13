const { config } = require('dotenv');
config({ path: '.env.local' });
// Set this to allow testing locally without cert issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const { db } = require('./src/lib/db/index.ts');
  const { sql } = require('drizzle-orm');
  const { hourlySalesMetrics, vwDailySalesMetrics } = require('./src/lib/db/schema.ts');

  // Hardcode date to matching date
  const lastBusinessDateStr = '2026-04-11';
  
  // 1. Get top stores to see what storeIds they have
  const topSucursalesRaw = await db
      .select({
        storeId:        vwDailySalesMetrics.storeId,
        storeName:      vwDailySalesMetrics.storeName,
        netSales:       sql`sum(${vwDailySalesMetrics.totalNetSales})`.mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = ${lastBusinessDateStr}::date`)
      .groupBy(vwDailySalesMetrics.storeId, vwDailySalesMetrics.storeName);
      
  console.log("Top Sucursales Store IDs:", topSucursalesRaw.map(s => s.storeId));

  // 2. Fetch raw hourly labor per store directly (exact same drizzle query)
  const laborPerStoreRaw = await db
        .select({
          storeId:      hourlySalesMetrics.storeId,
          businessHour: hourlySalesMetrics.businessHour,
          laborHrPay:   sql`MAX(${hourlySalesMetrics.hourlyJobTotalPay})`.mapWith(Number)
        })
        .from(hourlySalesMetrics)
        .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastBusinessDateStr}::date`)
        .groupBy(hourlySalesMetrics.storeId, hourlySalesMetrics.businessHour);
        
  console.log("Labor Query returned rows:", laborPerStoreRaw.length);
  if (laborPerStoreRaw.length > 0) {
    console.log("Labor Sample:", laborPerStoreRaw[0]);
    console.log("Labor Store IDs found:", [...new Set(laborPerStoreRaw.map(l => l.storeId))]);
  }
}

main().catch(console.error);
