process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;
const db = new Client({
  connectionString: 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
await db.connect();

const { rows: [s] } = await db.query(`SELECT COUNT(DISTINCT "BusinessDate") AS days, COUNT(*) AS rows, SUM("NetSales"::numeric) AS net, SUM("Guests") AS guests, SUM("LaborCost"::numeric) AS labor, SUM("Tips"::numeric) AS tips FROM "DailyConsolidatedMetrics"`);
console.log(`\n✅ DCM Total: días=${s.days} | Net=$${Number(s.net).toFixed(0)} | Guests=${s.guests} | Labor=$${Number(s.labor).toFixed(0)} | Tips=$${Number(s.tips).toFixed(0)}`);

const { rows: [ld] } = await db.query(`SELECT MAX("BusinessDate"::date) AS d FROM "DailyConsolidatedMetrics"`);
const lastDate = String(ld.d).slice(0,10);
const { rows: [day] } = await db.query(`SELECT SUM("NetSales"::numeric) AS net, SUM("Guests") AS g, SUM("LaborCost"::numeric) AS l, SUM("Tips"::numeric) AS tips, SUM("VisaPayments"::numeric) AS visa, SUM("CashPayments"::numeric) AS cash FROM "DailyConsolidatedMetrics" WHERE "BusinessDate" = $1`, [lastDate]);
console.log(`✅ DCM ${lastDate}: Net=$${Number(day.net).toFixed(2)} | Guests=${day.g} | Labor=$${Number(day.l).toFixed(0)} | Tips=$${Number(day.tips).toFixed(0)} | Visa=$${Number(day.visa).toFixed(0)} | Cash=$${Number(day.cash).toFixed(0)}`);

const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'DailyConsolidatedMetrics' ORDER BY ordinal_position`);
console.log(`\n✅ Columnas (${cols.length}): ${cols.map(c => c.column_name).join(', ')}`);

const { rows: [cov] } = await db.query(`SELECT COUNT(*) FILTER (WHERE "Tips"::numeric > 0) AS tips, COUNT(*) FILTER (WHERE "VisaPayments"::numeric > 0) AS visa, COUNT(*) FILTER (WHERE "LaborCost"::numeric > 0) AS labor, COUNT(*) AS total FROM "DailyConsolidatedMetrics"`);
console.log(`\n✅ Cobertura: Tips=${cov.tips}/${cov.total} | Visa=${cov.visa}/${cov.total} | Labor=${cov.labor}/${cov.total}`);

const { rows: top5 } = await db.query(`SELECT s."Name", d."NetSales", d."Guests", d."LaborCost", d."Tips", CASE WHEN d."LaborHours"::numeric > 0 THEN (d."NetSales"::numeric / d."LaborHours"::numeric) ELSE 0 END AS splh FROM "DailyConsolidatedMetrics" d JOIN "Stores" s ON s."Id" = d."StoreId" WHERE d."BusinessDate" = $1 ORDER BY d."NetSales"::numeric DESC LIMIT 5`, [lastDate]);
console.log(`\n🏪 Top 5 sucursales ${lastDate}:`);
top5.forEach((r, i) => {
  const name = String(r.Name).replace(/CFS Coffee\s*/ig,'').trim().replace(/^-\s*/,'').slice(0,22);
  console.log(`   ${i+1}. ${name.padEnd(22)} $${Number(r.NetSales).toFixed(0).padStart(7)} | ${String(r.Guests).padStart(3)}g | labor:$${Number(r.LaborCost).toFixed(0).padStart(4)} | tips:$${Number(r.Tips).toFixed(0).padStart(4)} | SpLH:$${Number(r.splh).toFixed(1)}`);
});
await db.end();
