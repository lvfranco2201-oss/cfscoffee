import { db } from '../db';
import { dailyConsolidatedMetrics, hourlySalesMetrics } from '../db/schema';
import { sum, asc, desc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { cleanStoreName } from '@/utils/formatters';

/**
 * Servicio de Costos Laborales — CFSCoffee BI
 *
 * Fuentes de datos:
 *  - DailyConsolidatedMetrics : KPIs, tendencia 30d, por sucursal, semanas (Toast API + histórico)
 *  - HourlySalesMetrics       : Detalle horario (labor por hora, open orders) — solo Aurora ETL
 */

const dcm = dailyConsolidatedMetrics;

export const getLaborMetrics = unstable_cache(
  async () => {
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${dcm.businessDate}::date)` })
      .from(dcm);
    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return null;

    const safe = (r: PromiseSettledResult<unknown>): unknown => {
      if (r.status === 'fulfilled') return r.value;
      console.error('[labor] query failed:', (r as PromiseRejectedResult).reason);
      return [];
    };

    const settled = await Promise.allSettled([

      /* 0: KPIs del día más reciente desde DailyConsolidatedMetrics */
      db.select({
        laborCost:      sum(dcm.laborCost).mapWith(Number),
        laborHours:     sum(dcm.laborHours).mapWith(Number),
        netSales:       sum(dcm.netSales).mapWith(Number),
        orders:         sum(dcm.orders).mapWith(Number),
        guests:         sum(dcm.guests).mapWith(Number),
        openOrders:     sum(dcm.openOrders).mapWith(Number),
        closedOrders:   sum(dcm.closedOrders).mapWith(Number),
        voidCount:      sum(dcm.voidCount).mapWith(Number),
        discountCount:  sum(dcm.discountCount).mapWith(Number),
        voids:          sum(dcm.voids).mapWith(Number),
        discounts:      sum(dcm.discounts).mapWith(Number),
        salesPerLH:     sql<number>`
          CASE WHEN SUM(${dcm.laborHours}::numeric) > 0
               THEN SUM(${dcm.netSales}::numeric) / SUM(${dcm.laborHours}::numeric)
               ELSE 0 END
        `.mapWith(Number),
      }).from(dcm).where(sql`${dcm.businessDate}::date = ${lastDate}::date`),

      /* 1: Labor por hora (curva) — sigue en HourlySalesMetrics */
      db.select({
        hour:       hourlySalesMetrics.businessHour,
        laborCost:  sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
        laborHours: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalHours}), 0)`.mapWith(Number),
        netSales:   sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        salesPerLH: sql<number>`COALESCE(AVG(${hourlySalesMetrics.hourlyJobSalesPerLaborHour}), 0)`.mapWith(Number),
        openOrders: sum(hourlySalesMetrics.openOrderCount).mapWith(Number),
        voidOrders: sum(hourlySalesMetrics.voidOrdersCount).mapWith(Number),
      }).from(hourlySalesMetrics)
        .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
        .groupBy(hourlySalesMetrics.businessHour)
        .orderBy(hourlySalesMetrics.businessHour),

      /* 2: Labor por sucursal 30d — desde DailyConsolidatedMetrics + JOIN Stores */
      db.execute(sql`
        SELECT
          d."StoreId"                                           AS "storeId",
          s."Name"                                              AS "storeName",
          SUM(d."LaborCost"::numeric)::float                   AS "laborCost",
          SUM(d."LaborHours"::numeric)::float                  AS "laborHours",
          SUM(d."NetSales"::numeric)::float                    AS "storeSales",
          SUM(d."Orders")::float                               AS "storeOrders",
          CASE WHEN SUM(d."LaborHours"::numeric) > 0
               THEN SUM(d."NetSales"::numeric) / SUM(d."LaborHours"::numeric)
               ELSE 0 END::float                               AS "avgSalesPerLH"
        FROM "DailyConsolidatedMetrics" d
        JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
        GROUP BY d."StoreId", s."Name"
        ORDER BY "laborCost" DESC
      `),

      /* 3: Labor trend 30d — desde DailyConsolidatedMetrics */
      db.execute(sql`
        SELECT
          "BusinessDate"::date                                  AS date,
          SUM("LaborCost"::numeric)::float                     AS "laborCost",
          SUM("LaborHours"::numeric)::float                    AS "laborHours",
          SUM("NetSales"::numeric)::float                      AS "netSales",
          SUM("Voids"::numeric)::float                         AS "voids",
          SUM("Discounts"::numeric)::float                     AS "discounts"
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
        GROUP BY "BusinessDate"::date
        ORDER BY "BusinessDate"::date
      `),

      /* 4: Labor por día de semana (promedio 90d) — desde DailyConsolidatedMetrics */
      db.execute(sql`
        SELECT dow,
          AVG(daily_labor)::float  AS "avgLaborCost",
          AVG(daily_hours)::float  AS "avgLaborHours",
          AVG(daily_sales)::float  AS "avgSales"
        FROM (
          SELECT
            EXTRACT(DOW FROM "BusinessDate"::date)::int    AS dow,
            SUM("LaborCost"::numeric)::float               AS daily_labor,
            SUM("LaborHours"::numeric)::float              AS daily_hours,
            SUM("NetSales"::numeric)::float                AS daily_sales
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
          GROUP BY "BusinessDate"::date, EXTRACT(DOW FROM "BusinessDate"::date)
        ) sub
        GROUP BY dow ORDER BY dow
      `),

      /* 5: Semana actual — desde DailyConsolidatedMetrics */
      db.select({
        laborCost:  sum(dcm.laborCost).mapWith(Number),
        laborHours: sum(dcm.laborHours).mapWith(Number),
        netSales:   sum(dcm.netSales).mapWith(Number),
        voidCount:  sum(dcm.voidCount).mapWith(Number),
        openOrders: sum(dcm.openOrders).mapWith(Number),
      }).from(dcm).where(sql`${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '6 days')`),

      /* 6: Semana anterior — desde DailyConsolidatedMetrics */
      db.select({
        laborCost:  sum(dcm.laborCost).mapWith(Number),
        laborHours: sum(dcm.laborHours).mapWith(Number),
        netSales:   sum(dcm.netSales).mapWith(Number),
      }).from(dcm).where(sql`
        ${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '13 days')
        AND ${dcm.businessDate}::date < (${lastDate}::date - INTERVAL '6 days')
      `),

      /* 7: Open orders por hora — sigue en HourlySalesMetrics */
      db.select({
        hour:         hourlySalesMetrics.businessHour,
        openOrders:   sum(hourlySalesMetrics.openOrderCount).mapWith(Number),
        closedOrders: sum(hourlySalesMetrics.closedOrderCount).mapWith(Number),
        voidOrders:   sum(hourlySalesMetrics.voidOrdersCount).mapWith(Number),
        totalOrders:  sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      }).from(hourlySalesMetrics)
        .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
        .groupBy(hourlySalesMetrics.businessHour)
        .orderBy(hourlySalesMetrics.businessHour),

      /* 8: Void/Discount trend 30d — desde DailyConsolidatedMetrics */
      db.select({
        businessDate: dcm.businessDate,
        voids:        sum(dcm.voids).mapWith(Number),
        discounts:    sum(dcm.discounts).mapWith(Number),
        refunds:      sum(dcm.refunds).mapWith(Number),
        grossSales:   sum(dcm.grossSales).mapWith(Number),
        netSales:     sum(dcm.netSales).mapWith(Number),
      }).from(dcm)
        .where(sql`${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')`)
        .groupBy(dcm.businessDate)
        .orderBy(asc(dcm.businessDate)),

      /* 9: Sales per labor hour por hora — sigue en HourlySalesMetrics */
      db.select({
        hour:       hourlySalesMetrics.businessHour,
        salesPerLH: sql<number>`COALESCE(AVG(${hourlySalesMetrics.hourlyJobSalesPerLaborHour}), 0)`.mapWith(Number),
        netSales:   sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        laborHours: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalHours}), 0)`.mapWith(Number),
      }).from(hourlySalesMetrics)
        .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
        .groupBy(hourlySalesMetrics.businessHour)
        .orderBy(hourlySalesMetrics.businessHour),
    ]);

    // Unwrap safely
    const kpisHoyRaw     = safe(settled[0]) as { laborCost: number; laborHours: number; netSales: number; orders: number; guests: number; openOrders: number; closedOrders: number; voidCount: number; discountCount: number; voids: number; discounts: number; salesPerLH: number }[];
    const laborByHour    = safe(settled[1]) as { hour: number; laborCost: number; laborHours: number; netSales: number; salesPerLH: number; openOrders: number; voidOrders: number }[];
    const laborByStore30 = safe(settled[2]);
    const laborTrend30   = safe(settled[3]);
    const laborByDow     = safe(settled[4]);
    const weekCurrRaw    = safe(settled[5]) as { laborCost: number; laborHours: number; netSales: number; voidCount: number; openOrders: number }[];
    const weekPrevRaw    = safe(settled[6]) as { laborCost: number; laborHours: number; netSales: number }[];
    const openOrderAnalysis = safe(settled[7]) as { hour: number; openOrders: number; closedOrders: number; voidOrders: number; totalOrders: number }[];
    const voidTrend30    = safe(settled[8]) as { businessDate: string | null; voids: number; discounts: number; refunds: number; grossSales: number; netSales: number }[];
    const salesPerLHbyHour = safe(settled[9]) as { hour: number; salesPerLH: number; netSales: number; laborHours: number }[];

    // ── Post-process ────────────────────────────────────────────────────────
    const kpi = kpisHoyRaw[0] ?? { laborCost: 0, laborHours: 0, netSales: 0, orders: 0, guests: 0, openOrders: 0, closedOrders: 0, voidCount: 0, discountCount: 0, voids: 0, discounts: 0, salesPerLH: 0 };
    const laborPct     = kpi.netSales > 0 ? (kpi.laborCost / kpi.netSales * 100) : 0;
    const salesPerLH   = kpi.laborHours > 0 ? kpi.netSales / kpi.laborHours : 0;
    const laborPerHour = kpi.laborHours > 0 ? kpi.laborCost / kpi.laborHours : 0;
    const openOrderRate = kpi.orders > 0 ? (kpi.openOrders / kpi.orders * 100) : 0;
    const voidOrderRate = kpi.orders > 0 ? (kpi.voidCount  / kpi.orders * 100) : 0;

    const hourlyFormatted = laborByHour.filter(h => h.laborCost > 0 || h.netSales > 0).map(h => {
      const ampm = h.hour >= 12 ? 'PM' : 'AM';
      const hr = h.hour % 12 || 12;
      const laborPctH = h.netSales > 0 ? (h.laborCost / h.netSales * 100) : 0;
      const oa = openOrderAnalysis.find(o => o.hour === h.hour);
      const openRate = oa && oa.totalOrders > 0 ? (oa.openOrders / oa.totalOrders * 100) : 0;
      return {
        time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`,
        laborCost: h.laborCost, laborHours: h.laborHours, ventas: h.netSales,
        laborPct: laborPctH, salesPerLH: h.salesPerLH, openOrderRate: openRate,
        voidOrders: h.voidOrders,
      };
    });

    const splhHourly = salesPerLHbyHour.map(h => {
      const hrVal = h.hour ?? 0;
      const ampm = hrVal >= 12 ? 'PM' : 'AM';
      const hr = hrVal % 12 || 12;
      return { time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`, salesPerLH: h.salesPerLH, netSales: h.netSales, laborHours: h.laborHours };
    });

    const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const toRows = (res: unknown): Record<string, unknown>[] => {
      if (Array.isArray(res)) return res as Record<string, unknown>[];
      const obj = res as { rows?: unknown[] };
      return (obj?.rows ?? []) as Record<string, unknown>[];
    };

    const trend30 = toRows(laborTrend30).map(row => {
      const lc = Number(row.laborCost ?? 0);
      const ns = Number(row.netSales  ?? 0);
      return {
        date:       String(row.date ?? '').slice(5, 10),
        laborCost:  lc,
        laborHours: Number(row.laborHours ?? 0),
        netSales:   ns,
        laborPct:   ns > 0 ? (lc / ns * 100) : 0,
        voidRate:   0,
        discountRate: 0,
      };
    });

    const byDowFormatted = toRows(laborByDow).map(row => {
      const dow = Number(row.dow ?? 0);
      const lc  = Number(row.avgLaborCost  ?? 0);
      const ns  = Number(row.avgSales      ?? 0);
      return {
        day:          DOW[dow] ?? `D${dow}`,
        dow,
        avgLaborCost:  lc,
        avgLaborHours: Number(row.avgLaborHours ?? 0),
        avgSales:      ns,
        avgLaborPct:   ns > 0 ? (lc / ns * 100) : 0,
      };
    }).sort((a, b) => a.dow - b.dow);

    const storeRows = toRows(laborByStore30).map(row => {
      const lc = Number(row.laborCost  ?? 0);
      const ss = Number(row.storeSales ?? 0);
      const lh = Number(row.laborHours ?? 0);
      return {
        storeId:      Number(row.storeId   ?? 0),
        storeName:    cleanStoreName(String(row.storeName ?? '')),
        laborCost:    lc,
        laborHours:   lh,
        storeSales:   ss,
        storeOrders:  Number(row.storeOrders  ?? 0),
        avgSalesPerLH: Number(row.avgSalesPerLH ?? 0),
        laborPct:     ss > 0 ? (lc / ss * 100) : 0,
        costPerHour:  lh > 0 ? (lc / lh) : 0,
      };
    });

    const voidDiscTrend = voidTrend30.map(d => {
      const gross = Number(d.grossSales ?? 0);
      return {
        date:         d.businessDate ? String(d.businessDate).slice(5) : '',
        voidRate:     gross > 0 ? (Number(d.voids     ?? 0) / gross * 100) : 0,
        discountRate: gross > 0 ? (Number(d.discounts ?? 0) / gross * 100) : 0,
        refundRate:   gross > 0 ? (Number(d.refunds   ?? 0) / gross * 100) : 0,
        netSales:     Number(d.netSales ?? 0),
      };
    });

    const curr = weekCurrRaw[0] ?? { laborCost: 0, laborHours: 0, netSales: 0, voidCount: 0, openOrders: 0 };
    const prev = weekPrevRaw[0] ?? { laborCost: 0, laborHours: 0, netSales: 0 };
    const wowLaborCost = prev.laborCost > 0 ? ((curr.laborCost - prev.laborCost) / prev.laborCost * 100) : 0;
    const currLaborPct = curr.netSales > 0 ? curr.laborCost / curr.netSales * 100 : 0;
    const prevLaborPct = prev.netSales > 0 ? prev.laborCost / prev.netSales * 100 : 0;

    return {
      lastDate,
      kpi: { ...kpi, laborPct, salesPerLH, laborPerHour, openOrderRate, voidOrderRate, voidOrders: kpi.voidCount },
      hourly: hourlyFormatted,
      storeRows,
      trend30,
      byDow: byDowFormatted,
      splhHourly,
      voidDiscTrend,
      currWeek: { ...curr, laborPct: currLaborPct },
      prevWeek: { ...prev, laborPct: prevLaborPct },
      wowLaborCost,
    };
  },
  ['labor-metrics-v5'],
  { revalidate: 300, tags: ['inventario', 'dashboard'] }
);
