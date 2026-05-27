/**
 * create-and-backfill.mjs
 * 1. Crea la tabla DailyConsolidatedMetrics en Aurora
 * 2. Hace backfill desde vw_StoreCompleteSummary (vista que ya tiene todo)
 * 3. Verifica el resultado
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';
const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
console.log('✅ Aurora conectado\n');

// ── PASO 1: Crear la tabla ──────────────────────────────────────────────────
console.log('🔧 Creando tabla DailyConsolidatedMetrics...');
await db.query(`
  CREATE TABLE IF NOT EXISTS "DailyConsolidatedMetrics" (
    "Id"                SERIAL PRIMARY KEY,
    "StoreId"           INTEGER     NOT NULL,
    "BusinessDate"      DATE        NOT NULL,
    "NetSales"          NUMERIC(14,4) DEFAULT 0,
    "GrossSales"        NUMERIC(14,4) DEFAULT 0,
    "Discounts"         NUMERIC(14,4) DEFAULT 0,
    "Voids"             NUMERIC(14,4) DEFAULT 0,
    "Refunds"           NUMERIC(14,4) DEFAULT 0,
    "AvgOrderValue"     NUMERIC(14,4) DEFAULT 0,
    "Guests"            BIGINT DEFAULT 0,
    "Orders"            BIGINT DEFAULT 0,
    "OpenOrders"        BIGINT DEFAULT 0,
    "ClosedOrders"      BIGINT DEFAULT 0,
    "VoidCount"         BIGINT DEFAULT 0,
    "DiscountCount"     BIGINT DEFAULT 0,
    "LaborCost"         NUMERIC(14,4) DEFAULT 0,
    "LaborHours"        NUMERIC(14,4) DEFAULT 0,
    "SalesPerLaborHour" NUMERIC(14,4) DEFAULT 0,
    "Tips"              NUMERIC(14,4) DEFAULT 0,
    "Tax"               NUMERIC(14,4) DEFAULT 0,
    "VisaPayments"      NUMERIC(14,4) DEFAULT 0,
    "MastercardPayments" NUMERIC(14,4) DEFAULT 0,
    "AmexPayments"      NUMERIC(14,4) DEFAULT 0,
    "CashPayments"      NUMERIC(14,4) DEFAULT 0,
    "OtherPayments"     NUMERIC(14,4) DEFAULT 0,
    "CreatedAt"         TIMESTAMPTZ DEFAULT NOW(),
    "UpdatedAt"         TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "uq_DailyConsolidatedMetrics_StoreDate" UNIQUE ("StoreId", "BusinessDate")
  )
`);
console.log('  ✅ Tabla creada\n');

// ── PASO 2: Backfill desde vw_StoreCompleteSummary ─────────────────────────
console.log('🔧 Backfill desde vw_StoreCompleteSummary (histórico completo)...');
const { rows: inserted } = await db.query(`
  INSERT INTO "DailyConsolidatedMetrics"
    ("StoreId","BusinessDate","NetSales","GrossSales","Discounts","Voids","Refunds",
     "AvgOrderValue","Guests","Orders","OpenOrders","ClosedOrders","VoidCount","DiscountCount",
     "LaborCost","LaborHours","SalesPerLaborHour",
     "Tips","Tax","VisaPayments","MastercardPayments","AmexPayments","CashPayments","OtherPayments")
  SELECT
    s."StoreId",
    s."BusinessDate",
    COALESCE(s."NetSales",           0),
    COALESCE(s."GrossSales",         0),
    COALESCE(s."TotalDiscounts",     0),
    COALESCE(s."TotalVoids",         0),
    COALESCE(s."TotalRefunds",       0),
    CASE WHEN COALESCE(s."TotalOrders",0) > 0
         THEN COALESCE(s."NetSales",0) / s."TotalOrders"
         ELSE 0 END,
    COALESCE(s."TotalGuests",        0),
    COALESCE(s."TotalOrders",        0),
    COALESCE(s."OpenOrders",         0),
    COALESCE(s."ClosedOrders",       0),
    COALESCE(s."VoidOrders",         0),
    COALESCE(s."DiscountOrders",     0),
    COALESCE(s."TotalLaborCost",     0),
    COALESCE(s."TotalLaborHours",    0),
    CASE WHEN COALESCE(s."TotalLaborHours",0) > 0
         THEN COALESCE(s."NetSales",0) / s."TotalLaborHours"
         ELSE 0 END,
    COALESCE(s."TotalTips",          0),
    COALESCE(s."TotalTax",           0),
    COALESCE(s."VisaPayments",       0),
    COALESCE(s."MastercardPayments", 0),
    COALESCE(s."AmexPayments",       0),
    COALESCE(s."CashPayments",       0),
    COALESCE(s."OtherCardPayments",  0) + COALESCE(s."DebitCardPayments", 0)
  FROM "vw_StoreCompleteSummary" s
  WHERE s."StoreId" IS NOT NULL
    AND s."BusinessDate" IS NOT NULL
  ON CONFLICT ("StoreId","BusinessDate") DO UPDATE SET
    "NetSales"          = EXCLUDED."NetSales",
    "GrossSales"        = EXCLUDED."GrossSales",
    "Discounts"         = EXCLUDED."Discounts",
    "Voids"             = EXCLUDED."Voids",
    "Refunds"           = EXCLUDED."Refunds",
    "AvgOrderValue"     = EXCLUDED."AvgOrderValue",
    "Guests"            = EXCLUDED."Guests",
    "Orders"            = EXCLUDED."Orders",
    "OpenOrders"        = EXCLUDED."OpenOrders",
    "ClosedOrders"      = EXCLUDED."ClosedOrders",
    "VoidCount"         = EXCLUDED."VoidCount",
    "DiscountCount"     = EXCLUDED."DiscountCount",
    "LaborCost"         = EXCLUDED."LaborCost",
    "LaborHours"        = EXCLUDED."LaborHours",
    "SalesPerLaborHour" = EXCLUDED."SalesPerLaborHour",
    "Tips"              = EXCLUDED."Tips",
    "Tax"               = EXCLUDED."Tax",
    "VisaPayments"      = EXCLUDED."VisaPayments",
    "MastercardPayments"= EXCLUDED."MastercardPayments",
    "AmexPayments"      = EXCLUDED."AmexPayments",
    "CashPayments"      = EXCLUDED."CashPayments",
    "OtherPayments"     = EXCLUDED."OtherPayments",
    "UpdatedAt"         = NOW()
  RETURNING "Id"
`);
console.log(`  ✅ ${inserted.length} filas insertadas/actualizadas\n`);

// ── PASO 3: Verificación ──────────────────────────────────────────────────
const { rows: check } = await db.query(`
  SELECT
    COUNT(DISTINCT "BusinessDate") AS days,
    COUNT(*)                       AS rows,
    SUM("NetSales")                AS total_net,
    MIN("BusinessDate")            AS from_date,
    MAX("BusinessDate")            AS to_date
  FROM "DailyConsolidatedMetrics"
`);
const r = check[0];
const { rows: top5 } = await db.query(`
  SELECT d."BusinessDate", s."Name", d."NetSales", d."Guests", d."Orders",
         d."LaborCost", d."Tips"
  FROM "DailyConsolidatedMetrics" d
  JOIN "Stores" s ON s."Id" = d."StoreId"
  ORDER BY d."BusinessDate" DESC, d."NetSales" DESC
  LIMIT 10
`);

console.log('📊 Resumen DailyConsolidatedMetrics:');
console.log(`   Días:          ${r.days}`);
console.log(`   Filas:         ${r.rows}`);
console.log(`   Ventas totales: $${Number(r.total_net).toLocaleString('en-US', {minimumFractionDigits:2})}`);
console.log(`   Rango:         ${r.from_date} → ${r.to_date}\n`);
console.log('📋 Últimos 10 registros:');
top5.forEach(row => {
  console.log(`   ${String(row.BusinessDate).slice(0,10)}  ${String(row.Name).padEnd(35)} $${Number(row.NetSales).toFixed(2).padStart(10)}  ${row.Guests} guests  labor:$${Number(row.LaborCost).toFixed(0)}  tips:$${Number(row.Tips).toFixed(0)}`);
});

await db.end();
console.log('\n✅ Completado.\n');
