import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyConsolidatedMetrics, stores } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * GET /api/dashboard/today
 * ─────────────────────────────────────────────────────────────────────────────
 * Devuelve datos de ventas de HOY desde DailyConsolidatedMetrics.
 * Estos datos son escritos por el cron toast-sync (GitHub Action cada 2h).
 *
 * La diferencia con /api/dashboard?range=today:
 *  - /api/dashboard       → lee vw_DailySalesMetrics (Aurora, datos de AYER)
 *  - /api/dashboard/today → lee DailyConsolidatedMetrics (Toast, datos de HOY)
 *
 * USO:
 *  El dashboard muestra un banner/card de "Hoy en tiempo real" que llama
 *  a este endpoint. Si no hay datos aún (sync no ha corrido), devuelve
 *  { available: false } y el dashboard muestra el estado del último sync.
 *
 * Cache: 5 minutos (el cron corre cada 2h, no tiene sentido más frecuente)
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url     = new URL(request.url);
    const storeId = url.searchParams.get('store') ?? 'all';

    // Fecha de hoy en Eastern Time (donde operan las tiendas)
    const todayET = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
    }).format(new Date());

    // Query a DailyConsolidatedMetrics (fuente: cron toast-sync)
    const storeFilter = storeId !== 'all'
      ? sql`AND ${dailyConsolidatedMetrics.storeId} = ${parseInt(storeId)}`
      : sql``;

    const [todayRows, storeRows] = await Promise.all([
      // KPIs consolidados de hoy
      db.execute(sql`
        SELECT
          SUM(${dailyConsolidatedMetrics.netSales}::numeric)   AS "netSales",
          SUM(${dailyConsolidatedMetrics.grossSales}::numeric) AS "grossSales",
          SUM(${dailyConsolidatedMetrics.guests})              AS "guests",
          SUM(${dailyConsolidatedMetrics.orders})              AS "orders",
          SUM(${dailyConsolidatedMetrics.laborCost}::numeric)  AS "laborCost",
          SUM(${dailyConsolidatedMetrics.laborHours}::numeric) AS "laborHours",
          MAX(${dailyConsolidatedMetrics.businessDate}::text)  AS "lastSyncDate",
          COUNT(*)                                             AS "storeCount"
        FROM ${dailyConsolidatedMetrics}
        WHERE ${dailyConsolidatedMetrics.businessDate}::date = ${todayET}::date
          ${storeFilter}
      `),

      // Desglose por sucursal de hoy
      db.execute(sql`
        SELECT
          d."StoreId"                          AS "storeId",
          s."Name"                             AS "storeName",
          d."NetSales"::numeric                AS "netSales",
          d."GrossSales"::numeric              AS "grossSales",
          d."Guests"                           AS "guests",
          d."Orders"                           AS "orders",
          d."LaborCost"::numeric               AS "laborCost",
          d."LaborHours"::numeric              AS "laborHours"
        FROM "vw_RealtimeConsolidatedMetrics" d
        LEFT JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date = ${todayET}::date
          ${storeId !== 'all'
            ? sql`AND d."StoreId" = ${parseInt(storeId)}`
            : sql``}
        ORDER BY d."NetSales"::numeric DESC
      `),
    ]);

    const rows     = Array.isArray(todayRows) ? todayRows : (todayRows as any).rows ?? [];
    const storeArr = Array.isArray(storeRows) ? storeRows : (storeRows as any).rows ?? [];

    const totals = rows[0] ?? {};
    const netSales   = Number(totals.netSales  ?? 0);
    const grossSales = Number(totals.grossSales ?? 0);
    const guests     = Number(totals.guests     ?? 0);
    const orders     = Number(totals.orders     ?? 0);
    const laborCost  = Number(totals.laborCost  ?? 0);
    const laborHours = Number(totals.laborHours ?? 0);
    const storeCount = Number(totals.storeCount ?? 0);

    // Si no hay datos de hoy todavía (cron no ha corrido o son las 6AM)
    if (storeCount === 0) {
      return NextResponse.json({
        available: false,
        date:      todayET,
        message:   'Sin datos de hoy aún. El cron de sincronización corre cada 2 horas.',
      }, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    return NextResponse.json({
      available:   true,
      date:        todayET,
      lastSync:    totals.lastSyncDate ?? todayET,
      storeCount,

      kpis: {
        netSales,
        grossSales,
        guests,
        orders,
        laborCost,
        laborHours,
        avgOrderValue:  orders > 0 ? netSales / orders : 0,
        laborPct:       netSales > 0 ? (laborCost / netSales) * 100 : 0,
        salesPerLaborHr: laborHours > 0 ? netSales / laborHours : 0,
      },

      stores: storeArr.map((s: any) => ({
        storeId:    Number(s.storeId),
        storeName:  String(s.storeName ?? 'Desconocida'),
        netSales:   Number(s.netSales  ?? 0),
        grossSales: Number(s.grossSales ?? 0),
        guests:     Number(s.guests    ?? 0),
        orders:     Number(s.orders    ?? 0),
        laborCost:  Number(s.laborCost ?? 0),
        laborHours: Number(s.laborHours ?? 0),
      })),
    }, {
      headers: { 'Cache-Control': 'private, max-age=300' }, // 5 min cache
    });

  } catch (err) {
    console.error('[API /dashboard/today]', err);
    return NextResponse.json({ error: 'Internal error', available: false }, { status: 500 });
  }
}
