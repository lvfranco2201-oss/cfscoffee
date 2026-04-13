const { config } = require('dotenv');
config({ path: '.env.local' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT labor_sub."StoreId" as "storeId", SUM(labor_sub."laborCostHour") as "totalLaborStore"
      FROM (
        SELECT "StoreId", "BusinessHour", MAX("HourlyJobTotalPay"::float) as "laborCostHour"
        FROM "HourlySalesMetrics"
        WHERE "BusinessDate"::date = '2026-04-11'::date
        GROUP BY "StoreId", "BusinessHour"
      ) labor_sub
      GROUP BY labor_sub."StoreId"
    `);
    console.log(res.rows);
  } finally {
    client.release();
    pool.end();
  }
}
main().catch(console.error);
