process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';

async function inspectAurora2() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const otherTables = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables in Aurora DB:");
  console.log(otherTables.rows.map(r => r.table_name));

  // Let's see distinct PaymentCardType
  const cardTypes = await db.query(`
    SELECT "PaymentCardType", COUNT(*) as count 
    FROM "PaymentData"
    GROUP BY "PaymentCardType"
  `);
  console.log("\nPaymentCardType in PaymentData:");
  console.log(cardTypes.rows);

  // Let's see if there are any payments where CardBrand is NULL
  const nullBrands = await db.query(`
    SELECT "PaymentCardType", "PaymentCardBrand", COUNT(*) as count 
    FROM "PaymentData"
    WHERE "PaymentCardBrand" IS NULL
    GROUP BY "PaymentCardType", "PaymentCardBrand"
  `);
  console.log("\nNull Brands in PaymentData:");
  console.log(nullBrands.rows);

  await db.end();
}

inspectAurora2().catch(console.error);
