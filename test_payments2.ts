const { config } = require('dotenv');
config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const { db } = require('./src/lib/db/index.ts');
  const { sql, sum } = require('drizzle-orm');
  const { paymentData } = require('./src/lib/db/schema.ts');

  const fromDate = '2026-04-11';
  const toDate = '2026-04-11';

  const res2 = await db.select({
      methodType:  paymentData.paymentCardType,
      totalAmount: sum(paymentData.paymentTotal).mapWith(Number),
    })
    .from(paymentData)
    .where(sql`${paymentData.settledDate}::text >= REPLACE(${fromDate}, '-', '') AND ${paymentData.settledDate}::text <= REPLACE(${toDate}, '-', '')`)
    .groupBy(paymentData.paymentCardType)
    .limit(10);
    
  console.log("With specific where clause:", res2);
}

main().catch(console.error);
