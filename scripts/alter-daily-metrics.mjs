/**
 * alter-daily-metrics.mjs
 * Agrega las columnas nuevas a DailyConsolidatedMetrics en Aurora
 * y luego hace backfill de 180 días desde Toast API.
 *
 * Ejecutar: node scripts/alter-daily-metrics.mjs
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import pg from 'pg';
const { Client } = pg;

const DB_URL      = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';
const TOAST_HOST  = 'https://ws-api.toasttab.com';
const CLIENT_ID   = 'HrXkKC1RvZnT99ikBZhTsycDq1D8Rgdn';
const CLIENT_SECRET = 'dRHdbn-vvt4EQ5R-uyIWSG_Y2hCNfPhrl-0UHhvruF2D2TIzsNRek84pGtyOOIbS';

const BACKFILL_DAYS = 180;

function dateET(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

// ── Toast Auth ────────────────────────────────────────────────────────────────
async function getToken() {
  const res = await fetch(`${TOAST_HOST}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, userAccessType: 'TOAST_MACHINE_CLIENT' }),
  });
  const data = await res.json();
  if (data.status !== 'SUCCESS') throw new Error('Auth failed: ' + JSON.stringify(data));
  console.log(`✅ Token Toast OK (${Math.round(data.token.expiresIn / 60)} min)`);
  return data.token.accessToken;
}

// ── Toast Analytics Job ───────────────────────────────────────────────────────
async function fetchMetrics(token, dateStr) {
  const fmt = dateStr.replace(/-/g, '');

  // POST: crear job
  const post = await fetch(`${TOAST_HOST}/era/v1/metrics/day`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startBusinessDate: fmt, restaurantIds: [], excludedRestaurantIds: [] }),
  });
  if (!post.ok) return null;
  const guid = await post.json();
  if (typeof guid !== 'string') return null;

  // POLL: esperar datos (200 + array = listo)
  for (let i = 0; i < 30; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 4000));
    const poll = await fetch(`${TOAST_HOST}/era/v1/metrics/${guid}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!poll.ok) return null;
    let body;
    try { body = await poll.json(); } catch { continue; }
    if (Array.isArray(body) && body.length > 0) return body;
    if (Array.isArray(body) && body.length === 0) return []; // Día sin ventas
  }
  return null; // timeout
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧 PASO 1: Conectando a Aurora...\n');
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('✅ Conexión exitosa\n');

  // ── PASO 1: ALTER TABLE ──────────────────────────────────────────────────────
  console.log('🔧 PASO 2: Agregando columnas nuevas a DailyConsolidatedMetrics...\n');

  const alterCols = [
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "Discounts"         NUMERIC(14,4) DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "Voids"             NUMERIC(14,4) DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "Refunds"           NUMERIC(14,4) DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "AvgOrderValue"     NUMERIC(14,4) DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "OpenOrders"        BIGINT DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "ClosedOrders"      BIGINT DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "VoidCount"         BIGINT DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "DiscountCount"     BIGINT DEFAULT 0`,
    `ALTER TABLE "DailyConsolidatedMetrics" ADD COLUMN IF NOT EXISTS "SalesPerLaborHour" NUMERIC(14,4) DEFAULT 0`,
  ];

  for (const sql of alterCols) {
    await db.query(sql);
    const col = sql.match(/"([A-Za-z]+)"\s+[A-Z]/)?.[0] ?? sql;
    console.log(`  ✅ ${col.replace(/"/g, '').replace(/\s+[A-Z].*/, '')}`);
  }

  // ── PASO 2: Obtener mapa GUID → StoreId ─────────────────────────────────────
  console.log('\n🔧 PASO 3: Cargando mapa de restaurantes de Aurora...');
  const { rows: storeRows } = await db.query(
    `SELECT "Id", "Name", "ExternalId" FROM "Stores" WHERE "IsActive" IS NOT FALSE AND "ExternalId" IS NOT NULL`
  );
  const guidToStore = new Map(storeRows.map(s => [s.ExternalId, { id: s.Id, name: s.Name }]));
  console.log(`  → ${guidToStore.size} sucursales con GUID asignado\n`);

  // ── PASO 3: Backfill desde Toast API ────────────────────────────────────────
  console.log(`🔧 PASO 4: Backfill de ${BACKFILL_DAYS} días desde Toast API...\n`);
  const token = await getToken();

  // Generar lista de fechas de más antigua a más reciente
  const dates = Array.from({ length: BACKFILL_DAYS }, (_, i) => dateET(BACKFILL_DAYS - 1 - i));

  let ok = 0, noData = 0, errors = 0;
  let totalNetSales = 0, totalOrders = 0;

  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    process.stdout.write(`  [${String(di + 1).padStart(3)}/${dates.length}] ${date} ... `);

    try {
      const records = await fetchMetrics(token, date);

      if (records === null) {
        console.log('⏱️  timeout');
        errors++;
        continue;
      }

      if (records.length === 0) {
        console.log('—  sin ventas');
        noData++;
        continue;
      }

      // Agregar por restaurante (puede haber múltiples filas por restaurante/hora)
      const byGuid = new Map();
      for (const row of records) {
        const ex = byGuid.get(row.restaurantGuid);
        if (!ex) {
          byGuid.set(row.restaurantGuid, {
            netSales:          Number(row.netSalesAmount     ?? 0),
            grossSales:        Number(row.grossSalesAmount   ?? 0),
            discounts:         Number(row.discountAmount     ?? 0),
            voids:             Number(row.voidOrdersAmount   ?? 0),
            refunds:           Number(row.refundAmount       ?? 0),
            avgOrderValue:     Number(row.avgOrderValue      ?? 0),
            guests:            Number(row.guestCount         ?? 0),
            orders:            Number(row.ordersCount        ?? 0),
            openOrders:        Number(row.openOrdersCount    ?? 0),
            closedOrders:      Number(row.closedOrdersCount  ?? 0),
            voidCount:         Number(row.voidOrdersCount    ?? 0),
            discountCount:     Number(row.discountOrderCount ?? 0),
            laborCost:         Number(row.hourlyJobTotalPay  ?? 0),
            laborHours:        Number(row.hourlyJobTotalHours ?? 0),
            salesPerLaborHour: Number(row.hourlyJobSalesPerLaborHour ?? 0),
          });
        } else {
          ex.netSales       += Number(row.netSalesAmount     ?? 0);
          ex.grossSales     += Number(row.grossSalesAmount   ?? 0);
          ex.discounts      += Number(row.discountAmount     ?? 0);
          ex.voids          += Number(row.voidOrdersAmount   ?? 0);
          ex.refunds        += Number(row.refundAmount       ?? 0);
          ex.guests         += Number(row.guestCount         ?? 0);
          ex.orders         += Number(row.ordersCount        ?? 0);
          ex.openOrders     += Number(row.openOrdersCount    ?? 0);
          ex.closedOrders   += Number(row.closedOrdersCount  ?? 0);
          ex.voidCount      += Number(row.voidOrdersCount    ?? 0);
          ex.discountCount  += Number(row.discountOrderCount ?? 0);
          ex.laborCost      += Number(row.hourlyJobTotalPay  ?? 0);
          ex.laborHours     += Number(row.hourlyJobTotalHours ?? 0);
          // avgOrderValue y salesPerLaborHour: usar el del restaurante con más ventas
          if (Number(row.netSalesAmount ?? 0) > ex.netSales - Number(row.netSalesAmount ?? 0)) {
            ex.avgOrderValue     = Number(row.avgOrderValue ?? 0);
            ex.salesPerLaborHour = Number(row.hourlyJobSalesPerLaborHour ?? 0);
          }
        }
      }

      let dayStores = 0;
      let dayNetSales = 0;

      for (const [guid, data] of byGuid) {
        const store = guidToStore.get(guid);
        if (!store) continue;

        const laborHours = data.laborHours;
        const spLH = laborHours > 0 ? (data.netSales / laborHours) : (data.salesPerLaborHour);

        await db.query(`
          INSERT INTO "DailyConsolidatedMetrics"
            ("StoreId","BusinessDate","NetSales","GrossSales","Discounts","Voids","Refunds",
             "AvgOrderValue","Guests","Orders","OpenOrders","ClosedOrders","VoidCount","DiscountCount",
             "LaborCost","LaborHours","SalesPerLaborHour")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
            "SalesPerLaborHour" = EXCLUDED."SalesPerLaborHour"
        `, [
          store.id, date,
          data.netSales.toFixed(4),   data.grossSales.toFixed(4),
          data.discounts.toFixed(4),  data.voids.toFixed(4),
          data.refunds.toFixed(4),    data.avgOrderValue.toFixed(4),
          data.guests,                data.orders,
          data.openOrders,            data.closedOrders,
          data.voidCount,             data.discountCount,
          data.laborCost.toFixed(4),  data.laborHours.toFixed(4),
          spLH.toFixed(4),
        ]);

        dayStores++;
        dayNetSales += data.netSales;
      }

      totalNetSales += dayNetSales;
      totalOrders   += Array.from(byGuid.values()).reduce((a, d) => a + d.orders, 0);
      console.log(`✅ ${dayStores} sucursales | $${dayNetSales.toFixed(0)}`);
      ok++;

    } catch (err) {
      console.log(`❌ ${err.message?.substring(0, 80)}`);
      errors++;
    }

    // Pequeña pausa cada 10 fechas para no saturar el rate limit de Toast
    if ((di + 1) % 10 === 0 && di < dates.length - 1) {
      process.stdout.write('  ⏸  Pausa 3s para respetar rate limits...\n');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // ── Verificación final ───────────────────────────────────────────────────────
  console.log('\n\n📊 Verificación final en Aurora...\n');
  const { rows: check } = await db.query(`
    SELECT
      COUNT(DISTINCT "BusinessDate") AS days,
      COUNT(*)                       AS rows,
      SUM("NetSales"::numeric)       AS total_net_sales,
      MIN("BusinessDate")            AS from_date,
      MAX("BusinessDate")            AS to_date
    FROM "DailyConsolidatedMetrics"
  `);
  const r = check[0];
  console.log(`  Días cubiertos : ${r.days}`);
  console.log(`  Filas totales  : ${r.rows}`);
  console.log(`  Ventas totales : $${Number(r.total_net_sales ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`  Rango          : ${r.from_date} → ${r.to_date}`);

  console.log(`\n✅ Backfill completado:`);
  console.log(`   OK:        ${ok} días`);
  console.log(`   Sin datos: ${noData} días (normales)`);
  console.log(`   Errores:   ${errors} días`);
  console.log(`   Total ventas sincronizadas: $${totalNetSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`);

  await db.end();
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
