/** add-indexes.mjs — Crear índices en DailyConsolidatedMetrics para performance */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
const { Client } = pg;

const db = new Client({
  connectionString: 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
await db.connect();
console.log('✅ Conectado a Aurora\n');

const indexes = [
  // Índice principal: fechas (el filtro más común)
  `CREATE INDEX IF NOT EXISTS "idx_dcm_businessdate"
   ON "DailyConsolidatedMetrics" ("BusinessDate" DESC)`,

  // Filtro por tienda
  `CREATE INDEX IF NOT EXISTS "idx_dcm_storeid"
   ON "DailyConsolidatedMetrics" ("StoreId")`,

  // Combinado tienda + fecha (el más común en los queries: WHERE date AND store)
  `CREATE INDEX IF NOT EXISTS "idx_dcm_store_date"
   ON "DailyConsolidatedMetrics" ("StoreId", "BusinessDate" DESC)`,

  // Upsert key: (StoreId, BusinessDate) — para el cron de sync
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_dcm_store_date_unique"
   ON "DailyConsolidatedMetrics" ("StoreId", "BusinessDate"::date)`,
];

for (const idx of indexes) {
  const name = idx.match(/"idx_dcm_\w+"/)?.[0] ?? 'unknown';
  try {
    await db.query(idx);
    console.log(`✅ Índice ${name} creado/verificado`);
  } catch (e) {
    const msg = e.message ?? String(e);
    if (msg.includes('already exists')) {
      console.log(`⚡ Índice ${name} ya existe (ok)`);
    } else {
      console.error(`❌ Error en ${name}:`, msg);
    }
  }
}

// Verificar índices existentes
const { rows: existingIdx } = await db.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'DailyConsolidatedMetrics'
  ORDER BY indexname
`);
console.log(`\n📋 ÍNDICES en DailyConsolidatedMetrics (${existingIdx.length}):`);
existingIdx.forEach(idx => {
  console.log(`   ${idx.indexname}`);
});

// Verificar tamaño de tabla y estimados de rows
const { rows: [stats] } = await db.query(`
  SELECT
    COUNT(*) AS rows,
    pg_size_pretty(pg_total_relation_size('"DailyConsolidatedMetrics"')) AS size,
    MIN("BusinessDate"::date) AS from_date,
    MAX("BusinessDate"::date) AS to_date,
    COUNT(DISTINCT "StoreId") AS stores
  FROM "DailyConsolidatedMetrics"
`);
console.log(`\n📊 ESTADÍSTICAS:`);
console.log(`   Filas:    ${stats.rows}`);
console.log(`   Tamaño:   ${stats.size}`);
console.log(`   Rango:    ${String(stats.from_date).slice(0,10)} → ${String(stats.to_date).slice(0,10)}`);
console.log(`   Tiendas:  ${stats.stores}`);

await db.end();
console.log('\n✅ Índices aplicados correctamente.\n');
