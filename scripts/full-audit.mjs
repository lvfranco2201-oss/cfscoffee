/** full-audit.mjs — Auditoría completa del sistema CFSCoffee BI */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;
const db = new Client({
  connectionString: 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
await db.connect();

const section = (t) => console.log(`\n${'═'.repeat(56)}\n  ${t}\n${'═'.repeat(56)}`);
const ok = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const info = (msg) => console.log(`  ℹ️  ${msg}`);
const row = (label, val) => console.log(`     ${label.padEnd(22)}${val}`);

// ── 1. TABLA DCM ──────────────────────────────────────────────────────────────
section('1. DailyConsolidatedMetrics — Estado General');
const { rows: [dcmStats] } = await db.query(`
  SELECT
    COUNT(*)                                  AS rows,
    COUNT(DISTINCT "StoreId")                 AS stores,
    COUNT(DISTINCT "BusinessDate"::date)      AS days,
    MIN("BusinessDate"::date)                 AS from_date,
    MAX("BusinessDate"::date)                 AS to_date,
    SUM("NetSales"::numeric)                  AS total_net,
    SUM("GrossSales"::numeric)                AS total_gross,
    SUM("Guests")                             AS total_guests,
    SUM("Orders")                             AS total_orders,
    SUM("LaborCost"::numeric)                 AS total_labor,
    SUM("Tips"::numeric)                      AS total_tips,
    SUM("Discounts"::numeric)                 AS total_discounts,
    SUM("Voids"::numeric)                     AS total_voids,
    SUM("VisaPayments"::numeric) + SUM("MastercardPayments"::numeric) + SUM("AmexPayments"::numeric) AS total_card,
    SUM("CashPayments"::numeric)              AS total_cash
  FROM "DailyConsolidatedMetrics"
`);
row('Filas:', dcmStats.rows);
row('Tiendas activas:', dcmStats.stores);
row('Días históricos:', dcmStats.days);
const fmtDate = (d) => d instanceof Date ? d.toISOString().slice(0,10) : String(d).slice(0,10);
row('Rango:', `${fmtDate(dcmStats.from_date)} → ${fmtDate(dcmStats.to_date)}`);
row('Net Sales total:', `$${Number(dcmStats.total_net).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Gross Sales total:', `$${Number(dcmStats.total_gross).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Labor Cost total:', `$${Number(dcmStats.total_labor).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Tips total:', `$${Number(dcmStats.total_tips).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Discounts total:', `$${Number(dcmStats.total_discounts).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Voids total:', `$${Number(dcmStats.total_voids).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Card payments:', `$${Number(dcmStats.total_card).toLocaleString('en-US',{minimumFractionDigits:2})}`);
row('Cash payments:', `$${Number(dcmStats.total_cash).toLocaleString('en-US',{minimumFractionDigits:2})}`);

// ── 2. COBERTURA DE CAMPOS ────────────────────────────────────────────────────
section('2. Cobertura de Campos Nuevos');
const { rows: [cov] } = await db.query(`
  SELECT
    COUNT(*) FILTER (WHERE "Tips"::numeric > 0)            AS tips_rows,
    COUNT(*) FILTER (WHERE "LaborCost"::numeric > 0)       AS labor_rows,
    COUNT(*) FILTER (WHERE "VisaPayments"::numeric > 0)    AS visa_rows,
    COUNT(*) FILTER (WHERE "CashPayments"::numeric > 0)    AS cash_rows,
    COUNT(*) FILTER (WHERE "Discounts"::numeric > 0)       AS disc_rows,
    COUNT(*) FILTER (WHERE "Voids"::numeric > 0)           AS void_rows,
    COUNT(*)                                               AS total
  FROM "DailyConsolidatedMetrics"
`);
const pct = (a, b) => `${a}/${b} (${b>0 ? (a/b*100).toFixed(1) : '0'}%)`;
row('Tips:', pct(Number(cov.tips_rows), Number(cov.total)));
row('LaborCost:', pct(Number(cov.labor_rows), Number(cov.total)));
row('Visa payments:', pct(Number(cov.visa_rows), Number(cov.total)));
row('Cash payments:', pct(Number(cov.cash_rows), Number(cov.total)));
row('Discounts:', pct(Number(cov.disc_rows), Number(cov.total)));
row('Voids:', pct(Number(cov.void_rows), Number(cov.total)));

if (Number(cov.labor_rows) < Number(cov.total) * 0.5) warn('LaborCost solo cubierto parcialmente');
else ok('Cobertura de campos aceptable');

// ── 3. ÚLTIMO DÍA COMPLETO ────────────────────────────────────────────────────
section('3. Último Día Disponible — Desglose por Sucursal');
const lastDate = dcmStats.to_date instanceof Date ? dcmStats.to_date.toISOString().slice(0,10) : String(dcmStats.to_date).slice(0,10);
const { rows: stores14 } = await db.query(`
  SELECT
    s."Name",
    d."NetSales"::float AS net, d."Guests" AS g, d."Orders" AS o,
    d."LaborCost"::float AS lc, d."Tips"::float AS tips,
    d."Discounts"::float AS disc,
    CASE WHEN d."LaborHours"::numeric > 0 THEN (d."NetSales"::numeric / d."LaborHours"::numeric)::float ELSE 0 END AS splh
  FROM "DailyConsolidatedMetrics" d
  JOIN "Stores" s ON s."Id" = d."StoreId"
  WHERE d."BusinessDate"::date = '${lastDate}'::date
  ORDER BY d."NetSales"::numeric DESC
`);
console.log(`\n  Fecha: ${lastDate} | ${stores14.length} sucursales\n`);
stores14.forEach((r, i) => {
  const name = String(r.Name).replace(/CFS Coffee\s*/ig,'').trim().replace(/^-\s*/,'').slice(0,20);
  const line = `  ${String(i+1).padStart(2)}. ${name.padEnd(21)} $${Number(r.net).toFixed(0).padStart(7)} | ${String(r.g).padStart(3)}g | lc:$${Number(r.lc).toFixed(0).padStart(5)} | tip:$${Number(r.tips).toFixed(0).padStart(4)} | spLH:$${Number(r.splh).toFixed(1).padStart(5)}`;
  console.log(line);
});

const totals = stores14.reduce((a, r) => ({ net: a.net + Number(r.net), guests: a.guests + Number(r.g), orders: a.orders + Number(r.o) }), { net: 0, guests: 0, orders: 0 });
console.log(`\n     ${'TOTAL'.padEnd(21)} $${totals.net.toFixed(0).padStart(7)} | ${String(totals.guests).padStart(3)}g`);

// ── 4. COMPARATIVA CON vw_DailySalesMetrics ────────────────────────────────
section('4. Consistencia: DCM vs vw_DailySalesMetrics');
const { rows: [vwDay] } = await db.query(`
  SELECT SUM("TotalNetSales"::numeric) AS net, SUM("TotalGuests") AS guests, SUM("TotalOrders") AS orders
  FROM "vw_DailySalesMetrics"
  WHERE "BusinessDate" = '${lastDate}'
`);
const dcmNet = totals.net;
const vwNet  = Number(vwDay?.net ?? 0);
const diff   = Math.abs(dcmNet - vwNet);
row('DCM Net Sales:', `$${dcmNet.toFixed(2)}`);
row('vw Net Sales:', `$${vwNet.toFixed(2)}`);
row('Diferencia:', `$${diff.toFixed(2)}`);
if (diff < 50)     ok(`Diferencia < $50 — datos consistentes`);
else if (diff < 500) warn(`Diferencia $50–$500 — posibles datos de hoy en DCM sin estar en vw (normal)`);
else               warn(`Diferencia > $500 — verificar sync`);

// ── 5. TENDENCIA 7 DÍAS ────────────────────────────────────────────────────
section('5. Tendencia Últimos 7 Días');
const { rows: trend7 } = await db.query(`
  SELECT
    "BusinessDate"::date                      AS date,
    SUM("NetSales"::numeric)::float           AS net,
    SUM("Guests")::float                      AS guests,
    SUM("LaborCost"::numeric)::float          AS labor,
    CASE WHEN SUM("NetSales"::numeric) > 0
         THEN SUM("LaborCost"::numeric) / SUM("NetSales"::numeric) * 100
         ELSE 0 END::float                   AS labor_pct
  FROM "DailyConsolidatedMetrics"
  WHERE "BusinessDate"::date >= ('${lastDate}'::date - INTERVAL '6 days')
  GROUP BY "BusinessDate"::date
  ORDER BY date
`);
trend7.forEach(r => {
  const d = r.date instanceof Date ? r.date.toISOString().slice(5,10) : String(r.date).slice(5,10);
  const bar = '█'.repeat(Math.round(Number(r.net) / 3000));
  console.log(`     ${d}  $${Number(r.net).toFixed(0).padStart(7)}  ${bar.slice(0,20)}  labor ${Number(r.labor_pct).toFixed(1)}%`);
});

// ── 6. ÍNDICES EXISTENTES ─────────────────────────────────────────────────
section('6. Índices de Performance');
const { rows: idxList } = await db.query(`
  SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid::text::regclass)) AS size
  FROM pg_indexes pi
  JOIN pg_class c ON c.relname = pi.indexname
  JOIN pg_stat_user_indexes psi ON psi.indexrelname = pi.indexname
  WHERE pi.tablename = 'DailyConsolidatedMetrics'
  ORDER BY pi.indexname
`).catch(() => ({ rows: [] }));
const { rows: idxSimple } = await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'DailyConsolidatedMetrics' ORDER BY indexname`);
idxSimple.forEach(i => console.log(`   ✅ ${i.indexname}`));

// ── 7. SERVICIOS — QUERY PERFORMANCE TEST ─────────────────────────────────
section('7. Performance — Queries de los Servicios');
const queries = [
  { name: 'KPIs hoy (dashboard)', sql: `SELECT SUM("NetSales"::numeric), SUM("Guests"), SUM("LaborCost"::numeric), SUM("Tips"::numeric) FROM "DailyConsolidatedMetrics" WHERE "BusinessDate" = '${lastDate}'` },
  { name: 'Trend 90d (ventas)', sql: `SELECT "BusinessDate"::date, SUM("NetSales"::numeric) FROM "DailyConsolidatedMetrics" WHERE "BusinessDate"::date >= '${lastDate}'::date - INTERVAL '89 days' GROUP BY "BusinessDate"::date ORDER BY 1` },
  { name: 'Top días histórico', sql: `SELECT "BusinessDate"::date, SUM("NetSales"::numeric) FROM "DailyConsolidatedMetrics" GROUP BY "BusinessDate"::date ORDER BY 2 DESC LIMIT 10` },
  { name: 'By store last 30d', sql: `SELECT "StoreId", SUM("NetSales"::numeric), SUM("LaborCost"::numeric) FROM "DailyConsolidatedMetrics" WHERE "BusinessDate"::date >= '${lastDate}'::date - INTERVAL '29 days' GROUP BY "StoreId" ORDER BY 2 DESC` },
  { name: 'MoM comparison', sql: `SELECT CASE WHEN "BusinessDate"::date >= DATE_TRUNC('month','${lastDate}'::date) THEN 'current' ELSE 'previous' END AS period, SUM("NetSales"::numeric) FROM "DailyConsolidatedMetrics" WHERE "BusinessDate"::date >= DATE_TRUNC('month','${lastDate}'::date - INTERVAL '1 month') GROUP BY period` },
];
for (const q of queries) {
  const t0 = Date.now();
  await db.query(q.sql);
  const ms = Date.now() - t0;
  const emoji = ms < 100 ? '🟢' : ms < 500 ? '🟡' : '🔴';
  console.log(`   ${emoji} ${q.name.padEnd(28)} ${ms}ms`);
}

await db.end();
console.log('\n✅ Auditoría completa.\n');
