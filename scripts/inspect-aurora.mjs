process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;
const DB_URL = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';
const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const tables = ['CheckData','HourlySalesMetrics','PaymentData','StoreGroups',
  'vw_DailyCheckSummary','vw_DailyPaymentSummary','vw_DailySalesMetrics','vw_StoreCompleteSummary'];

for (const t of tables) {
  const { rows: cols } = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`);
  const { rows: cnt } = await db.query(`SELECT COUNT(*) as n, MAX("BusinessDate") as max_date FROM "${t}" LIMIT 1`).catch(() => ({ rows: [{ n: 'error', max_date: 'error' }] }));
  console.log(`\n━━ "${t}" (${cnt[0]?.n ?? '?'} filas, hasta ${cnt[0]?.max_date ?? '?'})`);
  cols.forEach(c => console.log(`  ${c.column_name.padEnd(35)} ${c.data_type}`));
}
await db.end();
