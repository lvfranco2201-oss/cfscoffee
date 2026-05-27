import { db } from '../db';
import { dailyConsolidatedMetrics, hourlySalesMetrics, paymentData } from '../db/schema';
import { sum, asc, desc, sql } from 'drizzle-orm';

/**
 * Servicio de Ventas con filtros dinámicos — CFSCoffee BI
 * Fuente principal: DailyConsolidatedMetrics (Toast API vía cron)
 * Fuente secundaria: HourlySalesMetrics (solo DiningOption, OrderSource, RevenueCenter, curva horaria)
 * Acepta: range, storeId, customFrom, customTo
 */

export type DateRange =
  | 'today' | 'yesterday' | 'last_7' | 'last_30'
  | 'this_month' | 'last_month' | 'ytd' | 'custom';

export interface VentasFilter {
  range: DateRange;
  storeId?: string;
  customFrom?: string;
  customTo?: string;
}

const dcm = dailyConsolidatedMetrics;

// ─────────────────────────────────────────────────────────────────────────────
async function resolveRange(filter: VentasFilter): Promise<{ lastDate: string; fromDate: string; toDate: string }> {
  const latestRes = await db
    .select({ latestDate: sql<string>`MAX(${dcm.businessDate}::date)` })
    .from(dcm);
  const lastDate = latestRes[0]?.latestDate;
  if (!lastDate) throw new Error('NO_DATA');

  let fromDate: string, toDate: string;
  switch (filter.range) {
    case 'today':     fromDate = toDate = lastDate; break;
    case 'yesterday': { const d = new Date(lastDate + 'T12:00:00'); d.setDate(d.getDate() - 1); fromDate = toDate = d.toISOString().slice(0, 10); break; }
    case 'last_7':    fromDate = subtractDays(lastDate, 6);  toDate = lastDate; break;
    case 'last_30':   fromDate = subtractDays(lastDate, 29); toDate = lastDate; break;
    case 'this_month':  fromDate = lastDate.slice(0, 7) + '-01'; toDate = lastDate; break;
    case 'last_month': {
      const d = new Date(lastDate + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 1);
      const year = d.getFullYear(), month = String(d.getMonth() + 1).padStart(2, '0');
      fromDate = `${year}-${month}-01`;
      toDate = new Date(year, d.getMonth() + 1, 0).toISOString().slice(0, 10);
      break;
    }
    case 'ytd':    fromDate = lastDate.slice(0, 4) + '-01-01'; toDate = lastDate; break;
    case 'custom': fromDate = filter.customFrom ?? lastDate; toDate = filter.customTo ?? lastDate; break;
    default:       fromDate = toDate = lastDate;
  }
  return { lastDate, fromDate, toDate };
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00'), b = new Date(to + 'T12:00:00');
  return Math.max(Math.round((b.getTime() - a.getTime()) / 86400000), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
export async function getVentasMetricsFiltered(filter: VentasFilter) {
  const { lastDate, fromDate, toDate } = await resolveRange(filter);
  const sid = filter.storeId && filter.storeId !== 'all' ? parseInt(filter.storeId) : null;

  const dcmStoreSQL = sid ? sql`AND ${dcm.storeId} = ${sid}` : sql``;
  const hrStoreSQL  = sid ? sql`AND ${hourlySalesMetrics.storeId} = ${sid}` : sql``;

  const numDays = daysBetween(fromDate, toDate) + 1;
  const prevTo   = subtractDays(fromDate, 1);
  const prevFrom = subtractDays(fromDate, numDays);

  const [
    kpisPeriod,
    trendRaw,
    byDayOfWeek,
    byDiningOption,
    byOrderSource,
    byRevenueCenter,
    topDias,
    weekCurrent,
    weekPrev,
    paymentRaw,
    tipsRes,
    hourlyRaw,
    tipTrend30,
    tipByRestaurant,
    momComparison,
  ] = await Promise.all([

    // 1. KPIs del periodo — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        SUM("NetSales"::numeric)::float   AS "netSales",
        SUM("GrossSales"::numeric)::float AS "grossSales",
        SUM("Guests")::float              AS "guests",
        SUM("Orders")::float              AS "orders",
        SUM("Discounts"::numeric)::float  AS "discounts",
        SUM("Voids"::numeric)::float      AS "voids",
        SUM("Refunds"::numeric)::float    AS "refunds",
        SUM("Tips"::numeric)::float       AS "tips",
        SUM("LaborCost"::numeric)::float  AS "laborCost"
      FROM "DailyConsolidatedMetrics"
      WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date
        ${dcmStoreSQL}
    `),

    // 2. Tendencia diaria (últimos 90d desde lastDate) — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        "BusinessDate"::date                            AS date,
        SUM("NetSales"::numeric)::float                 AS "netSales",
        SUM("GrossSales"::numeric)::float               AS "grossSales",
        SUM("Guests")::float                            AS "guests",
        SUM("Orders")::float                            AS "orders",
        SUM("Discounts"::numeric)::float                AS "discounts"
      FROM "DailyConsolidatedMetrics"
      WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
        ${dcmStoreSQL}
      GROUP BY "BusinessDate"::date
      ORDER BY "BusinessDate"::date
    `),

    // 3. Ventas por día de semana (90d) — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT dow,
        AVG(daily_sum)::float    AS "avgSales",
        AVG(daily_guests)::float AS "avgGuests",
        AVG(daily_orders)::float AS "avgOrders"
      FROM (
        SELECT
          EXTRACT(DOW FROM "BusinessDate"::date)::int AS dow,
          SUM("NetSales"::numeric)::float             AS daily_sum,
          SUM("Guests")::float                        AS daily_guests,
          SUM("Orders")::float                        AS daily_orders
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
          ${dcmStoreSQL}
        GROUP BY "BusinessDate"::date, EXTRACT(DOW FROM "BusinessDate"::date)
      ) sub
      GROUP BY dow ORDER BY dow
    `),

    // 4. DiningOption — sigue en HourlySalesMetrics (datos únicos de canal)
    db.select({
      diningOption: hourlySalesMetrics.diningOption,
      netSales:     sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
      guests:       sum(hourlySalesMetrics.guestCount).mapWith(Number),
      orders:       sum(hourlySalesMetrics.ordersCount).mapWith(Number),
    })
    .from(hourlySalesMetrics)
    .where(sql`${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${hrStoreSQL}`)
    .groupBy(hourlySalesMetrics.diningOption)
    .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

    // 5. OrderSource — sigue en HourlySalesMetrics
    db.select({
      orderSource: hourlySalesMetrics.orderSource,
      netSales:    sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
      orders:      sum(hourlySalesMetrics.ordersCount).mapWith(Number),
    })
    .from(hourlySalesMetrics)
    .where(sql`
      ${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date
      AND ${hourlySalesMetrics.orderSource} IS NOT NULL
      AND ${hourlySalesMetrics.orderSource} != ''
      ${hrStoreSQL}
    `)
    .groupBy(hourlySalesMetrics.orderSource)
    .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

    // 6. RevenueCenter — sigue en HourlySalesMetrics
    db.select({
      revenueCenter: hourlySalesMetrics.revenueCenter,
      netSales:      sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
      orders:        sum(hourlySalesMetrics.ordersCount).mapWith(Number),
    })
    .from(hourlySalesMetrics)
    .where(sql`
      ${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date
      AND ${hourlySalesMetrics.revenueCenter} IS NOT NULL
      AND ${hourlySalesMetrics.revenueCenter} != ''
      ${hrStoreSQL}
    `)
    .groupBy(hourlySalesMetrics.revenueCenter)
    .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

    // 7. Top 10 mejores días (histórico) — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        "BusinessDate"::date                  AS date,
        SUM("NetSales"::numeric)::float       AS "netSales",
        SUM("Guests")::float                  AS "guests",
        SUM("Orders")::float                  AS "orders"
      FROM "DailyConsolidatedMetrics"
      ${sid ? sql`WHERE "StoreId" = ${sid}` : sql`WHERE 1=1`}
      GROUP BY "BusinessDate"::date
      ORDER BY "netSales" DESC
      LIMIT 10
    `),

    // 8. Periodo seleccionado (semana actual equiv) — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        SUM("NetSales"::numeric)::float   AS "netSales",
        SUM("Guests")::float              AS "guests",
        SUM("Orders")::float              AS "orders",
        SUM("Discounts"::numeric)::float  AS "discounts"
      FROM "DailyConsolidatedMetrics"
      WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date
        ${dcmStoreSQL}
    `),

    // 9. Periodo previo — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        SUM("NetSales"::numeric)::float   AS "netSales",
        SUM("Guests")::float              AS "guests",
        SUM("Orders")::float              AS "orders",
        SUM("Discounts"::numeric)::float  AS "discounts"
      FROM "DailyConsolidatedMetrics"
      WHERE "BusinessDate"::date BETWEEN ${prevFrom}::date AND ${prevTo}::date
        ${dcmStoreSQL}
    `),

    // 10. Métodos de pago del periodo — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        'Visa'        AS "methodType", SUM("VisaPayments"::numeric)::float       AS "totalAmount", SUM("Tips"::numeric)::float AS "totalTips", COUNT(*) AS "txCount"
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date ${dcmStoreSQL} AND "VisaPayments"::numeric > 0
      UNION ALL
      SELECT 'Mastercard', SUM("MastercardPayments"::numeric)::float, 0, COUNT(*)
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date ${dcmStoreSQL} AND "MastercardPayments"::numeric > 0
      UNION ALL
      SELECT 'Amex', SUM("AmexPayments"::numeric)::float, 0, COUNT(*)
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date ${dcmStoreSQL} AND "AmexPayments"::numeric > 0
      UNION ALL
      SELECT 'Efectivo', SUM("CashPayments"::numeric)::float, 0, COUNT(*)
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date ${dcmStoreSQL} AND "CashPayments"::numeric > 0
      UNION ALL
      SELECT 'Otro', SUM("OtherPayments"::numeric)::float, 0, COUNT(*)
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date ${dcmStoreSQL} AND "OtherPayments"::numeric > 0
    `),

    // 11. Tips totales del periodo — desde DailyConsolidatedMetrics
    db.select({ total: sum(dcm.tips).mapWith(Number) })
      .from(dcm)
      .where(sql`${dcm.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${dcmStoreSQL}`),

    // 12. Curva horaria del periodo — sigue en HourlySalesMetrics
    db.select({
      hour:      hourlySalesMetrics.businessHour,
      netSales:  sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
      guests:    sum(hourlySalesMetrics.guestCount).mapWith(Number),
      orders:    sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      discounts: sum(hourlySalesMetrics.discountAmount).mapWith(Number),
      laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
    })
    .from(hourlySalesMetrics)
    .where(sql`${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${hrStoreSQL}`)
    .groupBy(hourlySalesMetrics.businessHour)
    .orderBy(hourlySalesMetrics.businessHour),

    // 13. Tip rate trending 30d — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        "BusinessDate"::date                          AS date,
        SUM("Tips"::numeric)::float                   AS total_tips,
        SUM("NetSales"::numeric)::float               AS total_payments,
        COUNT(*)::int                                 AS tx_count
      FROM "DailyConsolidatedMetrics"
      WHERE "BusinessDate"::date >= (${toDate}::date - INTERVAL '29 days')
        AND "BusinessDate"::date <= ${toDate}::date
        ${dcmStoreSQL}
      GROUP BY "BusinessDate"::date
      ORDER BY date
    `),

    // 14. Tip rate por sucursal — desde DailyConsolidatedMetrics + Stores
    db.execute(sql`
      SELECT
        s."Name"                              AS "restaurantName",
        SUM(d."Tips"::numeric)::float         AS "totalTips",
        SUM(d."NetSales"::numeric)::float     AS "totalPayments",
        COUNT(*)::int                         AS "txCount"
      FROM "DailyConsolidatedMetrics" d
      JOIN "Stores" s ON s."Id" = d."StoreId"
      WHERE d."BusinessDate"::date BETWEEN ${fromDate}::date AND ${toDate}::date
        AND s."Name" IS NOT NULL
        ${dcmStoreSQL}
      GROUP BY s."Name"
      ORDER BY "totalTips" DESC
    `),

    // 15. MoM — desde DailyConsolidatedMetrics
    db.execute(sql`
      SELECT
        CASE WHEN "BusinessDate"::date >= DATE_TRUNC('month', ${toDate}::date) THEN 'current' ELSE 'previous' END AS period,
        SUM("NetSales"::numeric)::float   AS net_sales,
        SUM("Guests")::float              AS guests,
        SUM("Orders")::float              AS orders,
        SUM("Discounts"::numeric)::float  AS discounts,
        COUNT(DISTINCT "BusinessDate")    AS days
      FROM "DailyConsolidatedMetrics"
      WHERE "BusinessDate"::date >= DATE_TRUNC('month', ${toDate}::date - INTERVAL '1 month')
        AND "BusinessDate"::date <= ${toDate}::date
        ${dcmStoreSQL}
      GROUP BY period
    `),
  ]);

  // ── Post-process ──────────────────────────────────────────────────────────
  const toRows = (res: unknown): Record<string, unknown>[] =>
    Array.isArray(res) ? res as Record<string, unknown>[]
    : ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];

  // KPIs del periodo
  const kpiRow = toRows(kpisPeriod)[0] ?? {};
  const kpisHoy = {
    netSales:   Number(kpiRow.netSales   ?? 0),
    grossSales: Number(kpiRow.grossSales ?? 0),
    guests:     Number(kpiRow.guests     ?? 0),
    orders:     Number(kpiRow.orders     ?? 0),
    discounts:  Number(kpiRow.discounts  ?? 0),
    voids:      Number(kpiRow.voids      ?? 0),
    refunds:    Number(kpiRow.refunds    ?? 0),
    tips:       Number(kpiRow.tips       ?? 0),
    laborCost:  Number(kpiRow.laborCost  ?? 0),
  };

  // Curva horaria
  const peakHours = hourlyRaw.map(d => {
    const hrVal = d.hour ?? 0;
    const ampm = hrVal >= 12 ? 'PM' : 'AM';
    const hr = hrVal % 12 || 12;
    return { time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`, ventas: d.netSales, clientes: d.guests, ordenes: d.orders, labor: d.laborCost };
  });

  // Días de semana
  const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const byDow = toRows(byDayOfWeek).map((d: unknown) => {
    const row = d as Record<string, unknown>;
    const dow = Number(row.dow ?? 0);
    return { day: DOW_LABELS[dow] ?? `D${dow}`, dow, avgSales: Number(row.avgSales ?? 0), avgGuests: Number(row.avgGuests ?? 0), avgOrders: Number(row.avgOrders ?? 0) };
  }).sort((a, b) => a.dow - b.dow);

  // Tendencia + MA7
  const trendRows = toRows(trendRaw);
  const trend90Formatted = trendRows.map((d, i) => {
    const window = trendRows.slice(Math.max(0, i - 6), i + 1);
    const ma7 = window.reduce((a, x) => a + Number(x.netSales ?? 0), 0) / window.length;
    return {
      date: String(d.date ?? '').slice(5, 10),
      netSales: Number(d.netSales ?? 0), grossSales: Number(d.grossSales ?? 0),
      guests: Number(d.guests ?? 0), orders: Number(d.orders ?? 0),
      discounts: Number(d.discounts ?? 0), ma7: Math.round(ma7),
    };
  });

  // WoW
  const currWeek = toRows(weekCurrent)[0] ?? { netSales: 0, guests: 0, orders: 0, discounts: 0 };
  const prevWeek = toRows(weekPrev)[0]    ?? { netSales: 0, guests: 0, orders: 0, discounts: 0 };
  const currNet = Number(currWeek.netSales ?? 0), prevNet = Number(prevWeek.netSales ?? 0);
  const currGuests = Number(currWeek.guests ?? 0), prevGuests = Number(prevWeek.guests ?? 0);
  const wowSales  = prevNet    > 0 ? ((currNet    - prevNet)    / prevNet    * 100) : 0;
  const wowGuests = prevGuests > 0 ? ((currGuests - prevGuests) / prevGuests * 100) : 0;

  // Métodos de pago
  const PAYMENT_COLORS: Record<string, string> = { Visa: '#1a56db', Mastercard: '#e3342f', Amex: '#2d6a4f', Efectivo: '#3b82f6', Otro: '#9ca3af' };
  let totalCash = 0, totalCard = 0;
  const totalTips30 = tipsRes[0]?.total ?? 0;
  const paymentBreakdown: { name: string; value: number; tips: number; txCount: number; color: string }[] = [];
  toRows(paymentRaw).forEach((p: unknown) => {
    const row = p as Record<string, unknown>;
    const type = String(row.methodType ?? 'Otro');
    const amount = Number(row.totalAmount ?? 0);
    if (type === 'Efectivo') totalCash += amount;
    else totalCard += amount;
    paymentBreakdown.push({ name: type, value: amount, tips: Number(row.totalTips ?? 0), txCount: Number(row.txCount ?? 0), color: PAYMENT_COLORS[type] ?? '#9ca3af' });
  });

  // Tip rate trending
  const tipTrendFormatted = toRows(tipTrend30).map((d: unknown) => {
    const row = d as Record<string, unknown>;
    const tips = Number(row.total_tips ?? 0), payments = Number(row.total_payments ?? 0);
    return { date: String(row.date ?? '').slice(5, 10), totalTips: tips, totalPayments: payments, tipRate: payments > 0 ? (tips / payments * 100) : 0, txCount: Number(row.tx_count ?? 0) };
  });

  // Tip by restaurant
  const cleanName = (v: string | null | undefined) => {
    if (!v) return '—';
    let s = v.replace(/CFS Coffee/ig, '').trim();
    if (s.startsWith('-')) s = s.substring(1).trim();
    const parts = s.split('-').map((p: string) => p.trim()).filter(Boolean);
    return (parts.length > 1 && parts[0].length <= 4) ? parts[1] : parts[0] || v;
  };
  const tipByRestaurantFormatted = toRows(tipByRestaurant)
    .filter((t: unknown) => Number((t as Record<string, unknown>).totalTips ?? 0) > 0)
    .map((t: unknown) => {
      const row = t as Record<string, unknown>;
      const tips = Number(row.totalTips ?? 0), payments = Number(row.totalPayments ?? 0), txCount = Number(row.txCount ?? 0);
      return { name: cleanName(String(row.restaurantName ?? '')), totalTips: tips, totalPayments: payments, tipRate: payments > 0 ? (tips / payments * 100) : 0, avgTipPerTx: txCount > 0 ? (tips / txCount) : 0, txCount };
    })
    .sort((a: { tipRate: number }, b: { tipRate: number }) => b.tipRate - a.tipRate);

  // MoM
  let momCurr = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
  let momPrev = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
  toRows(momComparison).forEach((d: unknown) => {
    const row = d as Record<string, unknown>;
    const obj = { netSales: Number(row.net_sales ?? 0), guests: Number(row.guests ?? 0), orders: Number(row.orders ?? 0), discounts: Number(row.discounts ?? 0), days: Number(row.days ?? 0) };
    if (String(row.period) === 'current') momCurr = obj;
    else momPrev = obj;
  });
  const momSalesChg  = momPrev.netSales > 0 ? ((momCurr.netSales - momPrev.netSales) / momPrev.netSales * 100) : 0;
  const momGuestsChg = momPrev.guests   > 0 ? ((momCurr.guests   - momPrev.guests)   / momPrev.guests   * 100) : 0;

  // Top días
  const topDiasFormatted = toRows(topDias).map((d: unknown) => {
    const row = d as Record<string, unknown>;
    return { date: String(row.date ?? '').slice(0, 10), netSales: Number(row.netSales ?? 0), guests: Number(row.guests ?? 0), orders: Number(row.orders ?? 0) };
  });

  const currWeekFormatted  = { netSales: Number(currWeek.netSales ?? 0), guests: Number(currWeek.guests ?? 0), orders: Number(currWeek.orders ?? 0), discounts: Number(currWeek.discounts ?? 0) };
  const prevWeekFormatted  = { netSales: Number(prevWeek.netSales ?? 0), guests: Number(prevWeek.guests ?? 0), orders: Number(prevWeek.orders ?? 0), discounts: Number(prevWeek.discounts ?? 0) };

  return {
    lastDate, fromDate, toDate,
    kpisHoy,
    trend90: trend90Formatted,
    byDow,
    byDiningOption: byDiningOption.filter(d => d.diningOption),
    byOrderSource:  byOrderSource.filter(d => d.orderSource),
    byRevenueCenter: byRevenueCenter.filter(d => d.revenueCenter),
    topDias: topDiasFormatted,
    currWeek: currWeekFormatted, prevWeek: prevWeekFormatted, wowSales, wowGuests,
    paymentBreakdown, totalCash, totalCard, totalTips30,
    peakHours,
    tipTrend: tipTrendFormatted,
    tipByRestaurant: tipByRestaurantFormatted,
    momCurr, momPrev, momSalesChg, momGuestsChg,
  };
}
