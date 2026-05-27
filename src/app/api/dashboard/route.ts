import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyConsolidatedMetrics, hourlySalesMetrics, stores } from '@/lib/db/schema';
import { sum, desc, sql } from 'drizzle-orm';
import type { DateRange } from '@/context/FilterContext';

/**
 * GET /api/dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Fuente principal: DailyConsolidatedMetrics (Toast API vía cron + histórico Aurora)
 * Fuente secundaria: HourlySalesMetrics (solo para curva horaria — Aurora ETL)
 *
 * VENTAJAS vs versión anterior (vw_DailySalesMetrics):
 *  ✅ Incluye datos de HOY (el cron actualiza cada 2h)
 *  ✅ Incluye tips, tax, métodos de pago (Visa/MC/Amex/Cash) por día
 *  ✅ Incluye labor (costo y horas) directo sin subquery extra a HourlySalesMetrics
 *  ✅ Un JOIN menos (sin JOIN con PaymentData para totales diarios)
 */

const dcm = dailyConsolidatedMetrics;

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function resolveRange(
  range: DateRange, lastDate: string, customFrom?: string, customTo?: string
): Promise<{ fromDate: string; toDate: string }> {
  let fromDate: string, toDate: string;
  switch (range) {
    case 'today':     fromDate = toDate = lastDate; break;
    case 'yesterday': { const d = subtractDays(lastDate, 1); fromDate = toDate = d; break; }
    case 'last_7':    fromDate = subtractDays(lastDate, 6);  toDate = lastDate; break;
    case 'last_30':   fromDate = subtractDays(lastDate, 29); toDate = lastDate; break;
    case 'this_month':  fromDate = lastDate.slice(0, 7) + '-01'; toDate = lastDate; break;
    case 'last_month': {
      const d = new Date(lastDate + 'T12:00:00');
      d.setDate(1); d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
      fromDate = `${y}-${m}-01`;
      toDate = new Date(y, d.getMonth() + 1, 0).toISOString().slice(0, 10);
      break;
    }
    case 'ytd':    fromDate = lastDate.slice(0, 4) + '-01-01'; toDate = lastDate; break;
    case 'custom': fromDate = customFrom ?? lastDate; toDate = customTo ?? lastDate; break;
    default:       fromDate = toDate = lastDate;
  }
  return { fromDate, toDate };
}

const VALID_RANGES: DateRange[] = [
  'today','yesterday','last_7','last_30','this_month','last_month','ytd','custom'
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range      = (searchParams.get('range') ?? 'today') as DateRange;
    const storeId    = searchParams.get('store') ?? 'all';
    const customFrom = searchParams.get('from') ?? undefined;
    const customTo   = searchParams.get('to')   ?? undefined;

    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }

    // 1. Último businessDate disponible en DailyConsolidatedMetrics
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${dcm.businessDate}::date)` })
      .from(dcm);
    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return NextResponse.json({ error: 'No data' }, { status: 404 });

    const { fromDate, toDate } = await resolveRange(range, lastDate, customFrom, customTo);
    const sid = storeId !== 'all' ? parseInt(storeId) : null;

    // SQL fragments de filtro de tienda
    const storeFilter   = sid ? sql`AND ${dcm.storeId} = ${sid}` : sql``;
    const hrStoreFilter = sid ? sql`AND ${hourlySalesMetrics.storeId} = ${sid}` : sql``;

    const numDays  = Math.max(Math.round((new Date(toDate + 'T12:00:00').getTime() - new Date(fromDate + 'T12:00:00').getTime()) / 86400000), 0) + 1;
    const prevTo   = subtractDays(fromDate, 1);
    const prevFrom = subtractDays(fromDate, numDays);

    // 2. Queries en paralelo
    const [
      kpisRaw,
      prevKpisRaw,
      storesRaw,
      prevStoresRaw,
      hourlyRawObj,
      prevHourlyRawObj,
      avg30Raw,
      dailyTrendRaw,
      storesCatalogRaw,
    ] = await Promise.all([

      // ── KPIs del periodo (desde DailyConsolidatedMetrics) ──────────────────
      db.execute(sql`
        SELECT
          SUM("NetSales"::numeric)   AS "totalNetSales",
          SUM("GrossSales"::numeric) AS "totalGrossSales",
          SUM("Guests")              AS "totalGuests",
          SUM("Orders")              AS "totalOrders",
          SUM("Discounts"::numeric)  AS "totalDiscounts",
          SUM("Voids"::numeric)      AS "totalVoids",
          SUM("Refunds"::numeric)    AS "totalRefunds",
          SUM("LaborCost"::numeric)  AS "totalLaborCost",
          SUM("LaborHours"::numeric) AS "totalLaborHours",
          SUM("Tips"::numeric)       AS "totalTips",
          SUM("VisaPayments"::numeric) + SUM("MastercardPayments"::numeric) +
            SUM("AmexPayments"::numeric) + SUM("OtherPayments"::numeric) AS "totalCard",
          SUM("CashPayments"::numeric) AS "totalCash"
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date
          ${storeFilter}
      `),

      // ── KPIs periodo previo ────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          SUM("NetSales"::numeric)   AS "totalNetSales",
          SUM("GrossSales"::numeric) AS "totalGrossSales",
          SUM("Guests")              AS "totalGuests",
          SUM("Orders")              AS "totalOrders",
          SUM("Discounts"::numeric)  AS "totalDiscounts",
          SUM("Voids"::numeric)      AS "totalVoids",
          SUM("Refunds"::numeric)    AS "totalRefunds",
          SUM("LaborCost"::numeric)  AS "totalLaborCost",
          SUM("LaborHours"::numeric) AS "totalLaborHours",
          SUM("Tips"::numeric)       AS "totalTips"
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${prevFrom}::date AND ${prevTo}::date
          ${storeFilter}
      `),

      // ── Desglose por sucursal (periodo actual) ─────────────────────────────
      db.execute(sql`
        SELECT
          d."StoreId"                             AS "storeId",
          s."Name"                                AS "storeName",
          SUM(d."NetSales"::numeric)::float       AS "netSales",
          SUM(d."GrossSales"::numeric)::float     AS "grossSales",
          SUM(d."Guests")::float                  AS "guests",
          SUM(d."Orders")::float                  AS "orders",
          SUM(d."Discounts"::numeric)::float      AS "discounts",
          SUM(d."Voids"::numeric)::float          AS "voids",
          SUM(d."Refunds"::numeric)::float        AS "refunds",
          SUM(d."LaborCost"::numeric)::float      AS "laborCost",
          SUM(d."LaborHours"::numeric)::float     AS "laborHours",
          SUM(d."Tips"::numeric)::float           AS "tips"
        FROM "DailyConsolidatedMetrics" d
        JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date
          ${storeFilter}
        GROUP BY d."StoreId", s."Name"
        ORDER BY "netSales" DESC
      `),

      // ── Ventas previas por sucursal (solo netSales para delta) ─────────────
      db.execute(sql`
        SELECT "StoreId" AS "storeId", SUM("NetSales"::numeric)::float AS "netSales"
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${prevFrom}::date AND ${prevTo}::date
          ${storeFilter}
        GROUP BY "StoreId"
      `),

      // ── Curva horaria agregada — sigue en HourlySalesMetrics ──────────────
      db.execute(sql`
        SELECT
          hour,
          SUM("netSales")  AS "netSales",
          SUM("guests")    AS guests,
          SUM("orders")    AS orders,
          SUM("laborCost") AS "laborCost",
          SUM("laborHrs")  AS "laborHrs"
        FROM (
          SELECT
            ${hourlySalesMetrics.businessHour} AS hour,
            ${hourlySalesMetrics.storeId}      AS store_id,
            ${hourlySalesMetrics.businessDate} AS bdate,
            SUM(${hourlySalesMetrics.netSalesAmount}) AS "netSales",
            SUM(${hourlySalesMetrics.guestCount})     AS "guests",
            SUM(${hourlySalesMetrics.ordersCount})    AS "orders",
            MAX(${hourlySalesMetrics.hourlyJobTotalPay})   AS "laborCost",
            MAX(${hourlySalesMetrics.hourlyJobTotalHours}) AS "laborHrs"
          FROM ${hourlySalesMetrics}
          WHERE ${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date
            ${hrStoreFilter}
          GROUP BY ${hourlySalesMetrics.businessHour}, ${hourlySalesMetrics.storeId}, ${hourlySalesMetrics.businessDate}
        ) sub
        GROUP BY hour ORDER BY hour
      `),

      // ── Curva horaria del periodo previo (solo labor) ─────────────────────
      db.execute(sql`
        SELECT hour, SUM("laborCost") AS "laborCost", SUM("laborHrs") AS "laborHrs"
        FROM (
          SELECT
            ${hourlySalesMetrics.businessHour} AS hour,
            ${hourlySalesMetrics.storeId}      AS store_id,
            ${hourlySalesMetrics.businessDate} AS bdate,
            MAX(${hourlySalesMetrics.hourlyJobTotalPay})   AS "laborCost",
            MAX(${hourlySalesMetrics.hourlyJobTotalHours}) AS "laborHrs"
          FROM ${hourlySalesMetrics}
          WHERE ${hourlySalesMetrics.businessDate}::date BETWEEN ${prevFrom}::date AND ${prevTo}::date
            ${hrStoreFilter}
          GROUP BY ${hourlySalesMetrics.businessHour}, ${hourlySalesMetrics.storeId}, ${hourlySalesMetrics.businessDate}
        ) sub
        GROUP BY hour ORDER BY hour
      `),

      // ── Promedio 30d (para anomalías dinámicas) — desde DailyConsolidatedMetrics
      db.execute(sql`
        SELECT
          AVG(daily_net)::float    AS "avgNetSales",
          AVG(daily_guests)::float AS "avgGuests",
          AVG(daily_orders)::float AS "avgOrders"
        FROM (
          SELECT
            "BusinessDate"::date          AS d,
            SUM("NetSales"::numeric)::float AS daily_net,
            SUM("Guests")::float            AS daily_guests,
            SUM("Orders")::float            AS daily_orders
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '30 days')
            AND "BusinessDate"::date < ${lastDate}::date
            ${storeFilter}
          GROUP BY "BusinessDate"::date
        ) sub
      `),

      // ── Tendencia diaria (net + gross + labor + tips por fecha) ────────────
      db.execute(sql`
        SELECT
          "BusinessDate"::date                            AS date,
          SUM("NetSales"::numeric)::float                 AS "netSales",
          SUM("GrossSales"::numeric)::float               AS "grossSales",
          SUM("Discounts"::numeric)::float                AS "discounts",
          SUM("LaborCost"::numeric)::float                AS "laborCost",
          SUM("Tips"::numeric)::float                     AS "tips",
          SUM("Guests")::float                            AS "guests",
          SUM("Orders")::float                            AS "orders"
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date
          ${storeFilter}
        GROUP BY "BusinessDate"::date
        ORDER BY "BusinessDate"::date
      `),

      // ── Catálogo de tiendas activas ────────────────────────────────────────
      db.select({ id: stores.id, name: stores.name })
        .from(stores)
        .where(sql`${stores.isActive} IS NOT FALSE`)
        .orderBy(sql`${stores.name} ASC`),
    ]);

    // ── Post-process ─────────────────────────────────────────────────────────
    const toRows = (res: unknown) =>
      Array.isArray(res) ? res as Record<string, unknown>[]
      : ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];

    const kpisRow     = toRows(kpisRaw)[0]     ?? {};
    const prevKpisRow = toRows(prevKpisRaw)[0] ?? {};
    const avg30Row    = toRows(avg30Raw)[0]    ?? {};

    const kpis = {
      totalNetSales:   Number(kpisRow.totalNetSales   ?? 0),
      totalGrossSales: Number(kpisRow.totalGrossSales ?? 0),
      totalGuests:     Number(kpisRow.totalGuests     ?? 0),
      totalOrders:     Number(kpisRow.totalOrders     ?? 0),
      totalDiscounts:  Number(kpisRow.totalDiscounts  ?? 0),
      totalVoids:      Number(kpisRow.totalVoids      ?? 0),
      totalRefunds:    Number(kpisRow.totalRefunds    ?? 0),
      totalLaborCost:  Number(kpisRow.totalLaborCost  ?? 0),
      totalLaborHours: Number(kpisRow.totalLaborHours ?? 0),
      totalTips:       Number(kpisRow.totalTips       ?? 0),
    };

    const prevKpis = {
      totalNetSales:   Number(prevKpisRow.totalNetSales   ?? 0),
      totalGrossSales: Number(prevKpisRow.totalGrossSales ?? 0),
      totalGuests:     Number(prevKpisRow.totalGuests     ?? 0),
      totalOrders:     Number(prevKpisRow.totalOrders     ?? 0),
      totalDiscounts:  Number(prevKpisRow.totalDiscounts  ?? 0),
      totalVoids:      Number(prevKpisRow.totalVoids      ?? 0),
      totalRefunds:    Number(prevKpisRow.totalRefunds    ?? 0),
      totalLaborCost:  Number(prevKpisRow.totalLaborCost  ?? 0),
      totalLaborHours: Number(prevKpisRow.totalLaborHours ?? 0),
      totalTips:       Number(prevKpisRow.totalTips       ?? 0),
    };

    // Curva horaria
    const hourlyRaw     = toRows(hourlyRawObj);
    const prevHourlyRaw = toRows(prevHourlyRawObj);

    const totalLaborCost  = kpis.totalLaborCost;
    const totalLaborHours = kpis.totalLaborHours;

    const peakHours = hourlyRaw
      .filter(d => Number(d.netSales) > 0 || Number(d.laborCost) > 0)
      .map(d => {
        const h = Number(d.hour ?? 0), ampm = h >= 12 ? 'PM' : 'AM', hr = h % 12 || 12;
        return {
          time:     `${String(hr).padStart(2, '0')}:00 ${ampm}`,
          ventas:   Number(d.netSales),
          clientes: Number(d.guests),
          ordenes:  Number(d.orders),
          labor:    Number(d.laborCost),
        };
      });

    // Métodos de pago desde DailyConsolidatedMetrics (ya los tenemos en los KPIs)
    const totalCard = Number(kpisRow.totalCard ?? 0);
    const totalCash = Number(kpisRow.totalCash ?? 0);
    const totalTips = kpis.totalTips;

    const paymentMethods = [
      { name: 'Tarjeta / Digital', value: Math.max(0, totalCard - totalTips), color: 'var(--cfs-gold)' },
      { name: 'Efectivo',          value: totalCash,                           color: 'var(--info)' },
    ].filter(p => p.value > 0);

    // Desglose por sucursal con delta vs periodo previo
    const prevStoresMap = new Map(toRows(prevStoresRaw).map(s => [Number(s.storeId), Number(s.netSales ?? 0)]));
    const storesPerformance = toRows(storesRaw).map(s => ({
      storeId:      Number(s.storeId   ?? 0),
      storeName:    String(s.storeName ?? 'Desconocida'),
      netSales:     Number(s.netSales   ?? 0),
      grossSales:   Number(s.grossSales ?? 0),
      guests:       Number(s.guests     ?? 0),
      orders:       Number(s.orders     ?? 0),
      discounts:    Number(s.discounts  ?? 0),
      voids:        Number(s.voids      ?? 0),
      refunds:      Number(s.refunds    ?? 0),
      laborCost:    Number(s.laborCost  ?? 0),
      laborHours:   Number(s.laborHours ?? 0),
      tips:         Number(s.tips       ?? 0),
      prevNetSales: prevStoresMap.get(Number(s.storeId ?? 0)) ?? 0,
    }));

    // Tendencia diaria con labor integrada (ya viene en el mismo query)
    const dailyTrend = toRows(dailyTrendRaw).map(row => {
      const ns = Number(row.netSales  ?? 0);
      const lc = Number(row.laborCost ?? 0);
      return {
        date:        String(row.date ?? '').slice(0, 10),
        netSales:    ns,
        grossSales:  Number(row.grossSales ?? 0),
        discounts:   Number(row.discounts  ?? 0),
        laborCost:   lc,
        tips:        Number(row.tips       ?? 0),
        guests:      Number(row.guests     ?? 0),
        orders:      Number(row.orders     ?? 0),
        grossProfit: ns - lc,
      };
    });

    const avg30 = {
      avgNetSales: Number(avg30Row.avgNetSales ?? 0),
      avgGuests:   Number(avg30Row.avgGuests   ?? 0),
      avgOrders:   Number(avg30Row.avgOrders   ?? 0),
    };

    return NextResponse.json({
      lastDate, fromDate, toDate, numDays,
      kpis,
      prevKpis,
      storesPerformance,
      peakHours,
      paymentMethods,
      totalTips,
      prevTotalTips:       prevKpis.totalTips,
      totalLaborCost,
      prevTotalLaborCost:  prevKpis.totalLaborCost,
      totalLaborHours,
      prevTotalLaborHours: prevKpis.totalLaborHours,
      avg30,
      dailyTrend,
      availableStores: (storesCatalogRaw as { id: number; name: string | null }[]).map(s => ({
        id:   String(s.id),
        name: String(s.name ?? ''),
      })),
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });

  } catch (err) {
    console.error('[API /dashboard]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
