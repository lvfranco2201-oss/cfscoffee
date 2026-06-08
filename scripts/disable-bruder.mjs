process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;
const db = new Client({
  connectionString: 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await db.connect();
  const res = await db.query(`UPDATE "Stores" SET "IsActive" = false WHERE "Name" ILIKE '%BRUDER%' RETURNING *`);
  console.log(`Updated ${res.rowCount} stores.`);
  if (res.rowCount > 0) {
    console.log(res.rows.map(r => r.Name));
  }
  await db.end();
}

run().catch(console.error);
