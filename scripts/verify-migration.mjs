/** verify-migration.mjs — Verificación final de la migración */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;
const DB_URL = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';
const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   VERIFICACIÓN MIGRACIÓN — DailyConsolidatedMetrics     ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// 1. Resumen general
const { rows: [summary] } = await db.query(`
  SELECT
    COUNT(DISTINCT "BusinessDate") AS days,
    COUNT(*)                       AS rows,
    MIN("BusinessDate")            AS from_date,
    MAX("BusinessDate")            AS to_date,
    SUM("NetSales"::numeric)       AS total_net,
    SUM("GrossSales"::numeric)     AS total_gross,
    SUM("Guests")                  AS total_guests,
    SUM("Orders")                  AS total_orders,
    SUM("LaborCost"::numeric)      AS total_labor,
    SUM("LaborHours"::numeric)     AS total_hours,
    SUM("Tips"::numeric)           AS total_tips
  FROM "DailyConsolidatedMetrics"
`);
console.log('📊 RESUMEN GENERAL:');
console.log(`   Días:         ${summary.days}`);
console.log(`   Filas:        ${summary.rows}`);
console.log(`   Rango:        ${String(summary.from_date).slice(0,10)} → ${String(summary.to_date).slice(0,10)}`);
console.log(`   Net Sales:    $${Number(summary.total_net).toLocaleString('en-US',{minimumFractionDigits:2})}`);
console.log(`   Gross Sales:  $${Number(summary.total_gross).toLocaleString('en-US',{minimumFractionDigits:2})}`);
console.log(`   Guests:       ${Number(summary.total_guests).toLocaleString()}`);
console.log(`   Orders:       ${Number(summary.total_orders).toLocaleString()}`);
console.log(`   Labor Cost:   $${Number(summary.total_labor).toLocaleString('en-US',{minimumFractionDigits:2})}`);
console.log(`   Labor Hours:  ${Number(summary.total_hours).toFixed(0)}`);
console.log(`   Tips:         $${Number(summary.total_tips).toLocaleString('en-US',{minimumFractionDigits:2})}`);

// 2. Comparar último día vs vw_DailySalesMetrics
const lastDate = String(summary.to_date).slice(0,10);
const { rows: [dcmDay] } = await db.query(`
  SELECT SUM("NetSales"::numeric) AS net, SUM("Guests") AS guests, SUM("Orders") AS orders,
         SUM("LaborCost"::numeric) AS labor, SUM("Tips"::numeric) AS tips
  FROM "DailyConsolidatedMetrics" WHERE "BusinessDate"::date = '${lastDate}'::date
`);
const { rows: [vwDay] } = await db.query(`
  SELECT SUM("TotalNetSales"::numeric) AS net, SUM("TotalGuests") AS guests, SUM("TotalOrders") AS orders
  FROM "vw_DailySalesMetrics" WHERE "BusinessDate"::date = '${lastDate}'::date
`);
console.log(`\n📋 COMPARACIÓN ${lastDate} (DCM vs vw_DailySalesMetrics):`);
console.log(`   DCM  → Net: $${Number(dcmDay.net).toFixed(2)} | Guests: ${dcmDay.guests} | Orders: ${dcmDay.orders} | Labor: $${Number(dcmDay.labor).toFixed(0)} | Tips: $${Number(dcmDay.tips).toFixed(0)}`);
console.log(`   vwDM → Net: $${Number(vwDay.net).toFixed(2)} | Guests: ${vwDay.guests} | Orders: ${vwDay.orders}`);
const diff = Math.abs(Number(dcmDay.net) - Number(vwDay.net));
console.log(`   Diferencia Net Sales: $${diff.toFixed(2)} ${diff < 1 ? '✅ <$1 (perfecto)' : diff < 100 ? '⚠️ <$100 (aceptable)' : '❌ >$100 (verificar)'}`);

// 3. Top 5 sucursales último día
const { rows: top5 } = await db.query(`
  SELECT s."Name", d."NetSales", d."Guests", d."Orders", d."LaborCost", d."Tips",
    CASE WHEN d."LaborHours"::numeric > 0
         THEN (d."NetSales"::numeric / d."LaborHours"::numeric)::numeric(8,2)
         ELSE 0 END AS "SalesPerLH"
  FROM "DailyConsolidatedMetrics" d
  JOIN "Stores" s ON s."Id" = d."StoreId"
  WHERE d."BusinessDate"::date = '${lastDate}'::date
  ORDER BY d."NetSales"::numeric DESC
`);
console.log(`\n🏪 TOP 5 SUCURSALES — ${lastDate}:`);
top5.slice(0,5).forEach((r,i) => {
  const name = String(r.Name).replace('CFS Coffee','').replace('CFS Coffee ','').trim().replace(/^[-\s]+/,'').slice(0,25);
  console.log(`   ${i+1}. ${name.padEnd(25)} Net:$${Number(r.NetSales).toFixed(0).padStart(7)} | ${r.Guests}g | Labor:$${Number(r.LaborCost).toFixed(0)} | Tips:$${Number(r.Tips).toFixed(0)} | SpLH:$${Number(r.SalesPerLH).toFixed(1)}`);
});

// 4. Campos nuevos disponibles
const { rows: [colCheck] } = await db.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'DailyConsolidatedMetrics'
  ORDER BY ordinal_position
`);
const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'DailyConsolidatedMetrics' ORDER BY ordinal_position`);
console.log(`\n✅ COLUMNAS EN DailyConsolidatedMetrics (${cols.length}):`);
console.log(`   ${cols.map(c => c.column_name).join(', ')}`);

// 5. Cobertura de datos nuevos (tips, visa, etc)
const { rows: [coverage] } = await db.query(`
  SELECT
    COUNT(*) FILTER (WHERE "Tips"::numeric > 0)           AS rows_with_tips,
    COUNT(*) FILTER (WHERE "VisaPayments"::numeric > 0)   AS rows_with_visa,
    COUNT(*) FILTER (WHERE "CashPayments"::numeric > 0)   AS rows_with_cash,
    COUNT(*) FILTER (WHERE "LaborCost"::numeric > 0)      AS rows_with_labor,
    COUNT(*)                                               AS total_rows
  FROM "DailyConsolidatedMetrics"
`);
console.log(`\n📈 COBERTURA DE CAMPOS NUEVOS (${coverage.total_rows} filas total):`);
console.log(`   Tips:    ${coverage.rows_with_tips}/${coverage.total_rows} filas`);
console.log(`   Visa:    ${coverage.rows_with_visa}/${coverage.total_rows} filas`);
console.log(`   Cash:    ${coverage.rows_with_cash}/${coverage.total_rows} filas`);
console.log(`   Labor:   ${coverage.rows_with_labor}/${coverage.total_rows} filas`);

await db.end();
console.log('\n✅ Verificación completada.\n');
