process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';

async function inspectAurora() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const brands = await db.query(`
    SELECT "PaymentCardBrand", COUNT(*) as count 
    FROM "PaymentData"
    GROUP BY "PaymentCardBrand"
  `);
  console.log("PaymentCardBrand in PaymentData:");
  console.log(brands.rows);

  const nonCard = await db.query(`
    SELECT *
    FROM "PaymentData"
    WHERE "PaymentCardBrand" NOT IN ('VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'DISCOVER')
       OR "PaymentCardBrand" IS NULL
    LIMIT 20
  `);
  console.log("\nSample Non-Major Card Payments:");
  console.log(nonCard.rows);

  await db.end();
}

inspectAurora().catch(console.error);
