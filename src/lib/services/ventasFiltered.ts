import { db } from '../db';
import { vwDailySalesMetrics, hourlySalesMetrics, paymentData } from '../db/schema';
import { sum, asc, desc, sql } from 'drizzle-orm';

/**
 * Servicio de Ventas con filtros dinámicos — CFSCoffee BI
 * Acepta: range (today|yesterday|last_7|last_30|this_month|last_month|ytd|custom)
 *         storeId ('all' o ID numérico)
 *         customFrom / customTo (ISO yyyy-mm-dd, solo para range=custom)
 */

export type DateRange =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_30'
  | 'this_month'
  | 'last_month'
  | 'ytd'
  | 'custom';

export interface VentasFilter {
  range: DateRange;
  storeId?: string;      // 'all' o id numérico como string
  customFrom?: string;   // yyyy-mm-dd
  customTo?: string;     // yyyy-mm-dd
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve anchor date and [fromDate, toDate] SQL strings
// ─────────────────────────────────────────────────────────────────────────────
async function resolveRange(filter: VentasFilter): Promise<{ lastDate: string; fromDate: string; toDate: string }> {
  // Always anchor on the latest businessDate in the DB
  const latestRes = await db
    .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
    .from(vwDailySalesMetrics);

  const lastDate = latestRes[0]?.latestDate;
  if (!lastDate) throw new Error('NO_DATA');

  let fromDate: string;
  let toDate: string;

  switch (filter.range) {
    case 'today':
      fromDate = lastDate;
      toDate = lastDate;
      break;
    case 'yesterday': {
      // The day before lastDate
      const d = new Date(lastDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      fromDate = d.toISOString().slice(0, 10);
      toDate = fromDate;
      break;
    }
    case 'last_7':
      fromDate = subtractDays(lastDate, 6);
      toDate = lastDate;
      break;
    case 'last_30':
      fromDate = subtractDays(lastDate, 29);
      toDate = lastDate;
      break;
    case 'this_month':
      fromDate = lastDate.slice(0, 7) + '-01';
      toDate = lastDate;
      break;
    case 'last_month': {
      const d = new Date(lastDate + 'T12:00:00');
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      fromDate = `${year}-${month}-01`;
      // End of that month
      const endD = new Date(year, d.getMonth() + 1, 0);
      toDate = endD.toISOString().slice(0, 10);
      break;
    }
    case 'ytd':
      fromDate = lastDate.slice(0, 4) + '-01-01';
      toDate = lastDate;
      break;
    case 'custom':
      fromDate = filter.customFrom ?? lastDate;
      toDate = filter.customTo ?? lastDate;
      break;
    default:
      fromDate = lastDate;
      toDate = lastDate;
  }

  return { lastDate, fromDate, toDate };
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function (no cache — called from API route which can add its own cache)
// ─────────────────────────────────────────────────────────────────────────────
export async function getVentasMetricsFiltered(filter: VentasFilter) {
  const { lastDate, fromDate, toDate } = await resolveRange(filter);
  const sid = filter.storeId && filter.storeId !== 'all' ? parseInt(filter.storeId) : null;

  // ── Store filter SQL ───────────────────────────────────────────────────────
  const vwStoreSQL  = sid ? sql`AND ${vwDailySalesMetrics.storeId} = ${sid}`  : sql``;
  const hrStoreSQL  = sid ? sql`AND ${hourlySalesMetrics.storeId} = ${sid}`   : sql``;
  const payStoreSQL = sid ? sql`AND ${paymentData.restaurantName} IS NOT NULL` : sql``; // payment table has no storeId

  const numDays = daysBetween(fromDate, toDate) + 1;
  const prevTo = subtractDays(fromDate, 1);
  const prevFrom = subtractDays(fromDate, numDays);

  // ── Parallel queries ───────────────────────────────────────────────────────
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

    // 1. KPIs del periodo seleccionado
    db.select({
      netSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      grossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
      guests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
      orders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      discounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
      voids:      sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
      refunds:    sum(vwDailySalesMetrics.totalRefunds).mapWith(Number),
    })
    .from(vwDailySalesMetrics)
    .where(sql`${vwDailySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${vwStoreSQL}`),

    // 2. Tendencia diaria del periodo (para chart)
    db.select({
      date:       vwDailySalesMetrics.businessDate,
      netSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      grossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
      guests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
      orders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      discounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
    })
    .from(vwDailySalesMetrics)
    .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '89 days') ${vwStoreSQL}`)
    .groupBy(vwDailySalesMetrics.businessDate)
    .orderBy(asc(vwDailySalesMetrics.businessDate)),

    // 3. Ventas por día de semana (últimos 90d siempre, ignora filtro de periodo para más datos)
    db.execute(sql`
      SELECT
        dow,
        AVG(daily_sum)    AS "avgSales",
        AVG(daily_guests) AS "avgGuests",
        AVG(daily_orders) AS "avgOrders"
      FROM (
        SELECT
          EXTRACT(DOW FROM "BusinessDate"::date)::int AS dow,
          SUM("TotalNetSales")::float                 AS daily_sum,
          SUM("TotalGuests")::float                   AS daily_guests,
          SUM("TotalOrders")::float                   AS daily_orders
        FROM "vw_DailySalesMetrics"
        WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
        ${sid ? sql`AND "StoreId" = ${sid}` : sql``}
        GROUP BY "BusinessDate"::date, EXTRACT(DOW FROM "BusinessDate"::date)
      ) AS sub
      GROUP BY dow
      ORDER BY dow
    `),

    // 4. Ventas por DiningOption (periodo seleccionado)
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

    // 5. Ventas por OrderSource (periodo)
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

    // 6. Ventas por RevenueCenter (periodo)
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

    // 7. Top 10 mejores días (histórico completo, siempre)
    db.select({
      date:     vwDailySalesMetrics.businessDate,
      netSales: sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      guests:   sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
      orders:   sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
    })
    .from(vwDailySalesMetrics)
    .where(sid ? sql`${vwDailySalesMetrics.storeId} = ${sid}` : sql`1=1`)
    .groupBy(vwDailySalesMetrics.businessDate)
    .orderBy(desc(sum(vwDailySalesMetrics.totalNetSales)))
    .limit(10),

    // 8. "Semana actual" = periodo seleccionado
    db.select({
      netSales:  sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
      orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      discounts: sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
    })
    .from(vwDailySalesMetrics)
    .where(sql`${vwDailySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${vwStoreSQL}`),

    // 9. "Semana anterior" = periodo equivalente antes del seleccionado
    db.select({
      netSales:  sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
      orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      discounts: sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
    })
    .from(vwDailySalesMetrics)
    .where(sql`${vwDailySalesMetrics.businessDate}::date BETWEEN ${prevFrom}::date AND ${prevTo}::date ${vwStoreSQL}`),

    // 10. Métodos de pago (periodo)
    db.select({
      methodType:  paymentData.paymentCardType,
      totalAmount: sum(paymentData.paymentTotal).mapWith(Number),
      totalTips:   sum(paymentData.tipAmount).mapWith(Number),
      txCount:     sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(paymentData)
    .where(sql`TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') BETWEEN ${fromDate}::date AND ${toDate}::date`)
    .groupBy(paymentData.paymentCardType)
    .orderBy(desc(sum(paymentData.paymentTotal))),

    // 11. Tips totales del periodo
    db.select({ total: sum(paymentData.tipAmount).mapWith(Number) })
      .from(paymentData)
      .where(sql`TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') BETWEEN ${fromDate}::date AND ${toDate}::date`),

    // 12. Curva horaria: solo si el periodo es 1 día, si no, agregado por hora
    db.select({
      hour:     hourlySalesMetrics.businessHour,
      netSales: sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
      guests:   sum(hourlySalesMetrics.guestCount).mapWith(Number),
      orders:   sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      discounts: sum(hourlySalesMetrics.discountAmount).mapWith(Number),
      laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
    })
    .from(hourlySalesMetrics)
    .where(sql`${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${hrStoreSQL}`)
    .groupBy(hourlySalesMetrics.businessHour)
    .orderBy(hourlySalesMetrics.businessHour),

    // 13. Tip rate trending (últimos 30d desde toDate, siempre fijo en 30d)
    db.execute(sql`
      SELECT
        TO_DATE(${paymentData.settledDate}, 'YYYYMMDD')   AS date,
        SUM(${paymentData.tipAmount})::float               AS total_tips,
        SUM(${paymentData.paymentTotal})::float            AS total_payments,
        COUNT(*)::int                                       AS tx_count
      FROM "PaymentData"
      WHERE ${paymentData.settledDate} IS NOT NULL
        AND TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') >= (${toDate}::date - INTERVAL '29 days')
        AND TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') <= ${toDate}::date
      GROUP BY TO_DATE(${paymentData.settledDate}, 'YYYYMMDD')
      ORDER BY date
    `),

    // 14. Tip rate por restaurante (periodo)
    db.select({
      restaurantName: paymentData.restaurantName,
      totalTips:      sum(paymentData.tipAmount).mapWith(Number),
      totalPayments:  sum(paymentData.paymentTotal).mapWith(Number),
      txCount:        sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(paymentData)
    .where(sql`
      ${paymentData.settledDate} IS NOT NULL
      AND TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') BETWEEN ${fromDate}::date AND ${toDate}::date
      AND ${paymentData.restaurantName} IS NOT NULL
    `)
    .groupBy(paymentData.restaurantName)
    .orderBy(desc(sum(paymentData.tipAmount))),

    // 15. MoM: mes del toDate vs mes anterior
    db.execute(sql`
      SELECT
        CASE
          WHEN "BusinessDate"::date >= DATE_TRUNC('month', ${toDate}::date)
          THEN 'current'
          ELSE 'previous'
        END AS period,
        SUM("TotalNetSales")::float   AS net_sales,
        SUM("TotalGuests")::float     AS guests,
        SUM("TotalOrders")::float     AS orders,
        SUM("TotalDiscounts")::float  AS discounts,
        COUNT(DISTINCT "BusinessDate") AS days
      FROM "vw_DailySalesMetrics"
      WHERE "BusinessDate"::date >= DATE_TRUNC('month', ${toDate}::date - INTERVAL '1 month')
        AND "BusinessDate"::date <= ${toDate}::date
        ${sid ? sql`AND "StoreId" = ${sid}` : sql``}
      GROUP BY period
    `),
  ]);

  // ── Post-process (same as original service) ────────────────────────────────

  const toRows = (res: unknown) =>
    Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);

  // Curva horaria
  const peakHours = hourlyRaw.map(d => {
    const hrVal = d.hour ?? 0;
    const ampm = hrVal >= 12 ? 'PM' : 'AM';
    const hr = hrVal % 12 || 12;
    return {
      time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`,
      ventas: d.netSales, clientes: d.guests, ordenes: d.orders, labor: d.laborCost,
    };
  });

  // Días de semana
  const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const byDow = toRows(byDayOfWeek)
    .map((d: unknown) => {
      const row = d as Record<string, unknown>;
      const dow = Number(row.dow ?? 0);
      return {
        day: DOW_LABELS[dow] ?? `D${dow}`, dow,
        avgSales:  Number(row.avgSales  ?? 0),
        avgGuests: Number(row.avgGuests ?? 0),
        avgOrders: Number(row.avgOrders ?? 0),
      };
    }).sort((a, b) => a.dow - b.dow);

  // Tendencia + MA7
  const trend90Formatted = trendRaw.map((d, i) => {
    const window = trendRaw.slice(Math.max(0, i - 6), i + 1);
    const ma7 = window.reduce((a, x) => a + x.netSales, 0) / window.length;
    return {
      date: (d.date ?? '').slice(5),
      netSales: d.netSales, grossSales: d.grossSales, guests: d.guests,
      orders: d.orders, discounts: d.discounts, ma7: Math.round(ma7),
    };
  });

  // WoW
  const currWeek = weekCurrent[0] ?? { netSales: 0, guests: 0, orders: 0, discounts: 0 };
  const prevWeek = weekPrev[0]    ?? { netSales: 0, guests: 0, orders: 0, discounts: 0 };
  const wowSales  = prevWeek.netSales > 0 ? ((currWeek.netSales  - prevWeek.netSales)  / prevWeek.netSales  * 100) : 0;
  const wowGuests = prevWeek.guests   > 0 ? ((currWeek.guests    - prevWeek.guests)    / prevWeek.guests    * 100) : 0;

  // Payments
  let totalCash = 0, totalCard = 0;
  const totalTips30 = tipsRes[0]?.total ?? 0;
  const paymentBreakdown: { name: string; value: number; tips: number; txCount: number; color: string }[] = [];
  paymentRaw.forEach(p => {
    const type = p.methodType ? p.methodType.toUpperCase() : 'CASH';
    const isCash = type === 'CASH' || type.includes('CASH');
    if (isCash) {
      totalCash += p.totalAmount;
      paymentBreakdown.push({ name: 'Efectivo', value: p.totalAmount, tips: p.totalTips, txCount: p.txCount, color: '#3b82f6' });
    } else {
      totalCard += p.totalAmount;
      paymentBreakdown.push({ name: p.methodType ?? 'Otro', value: p.totalAmount, tips: p.totalTips, txCount: p.txCount, color: '#DDA756' });
    }
  });

  const expectedSumVentas = kpisPeriod[0]?.netSales ? Number(kpisPeriod[0].netSales) + (tipsRes[0]?.total ?? 0) : 0;
  const currentSumVentas = totalCash + totalCard;
  if (expectedSumVentas > currentSumVentas && currentSumVentas > 0) {
    paymentBreakdown.push({
      name: 'Plataformas / Delivery',
      value: expectedSumVentas - currentSumVentas,
      tips: 0,
      txCount: 0,
      color: '#94A3B8'
    });
  }

  // Tip trend
  const tipTrendFormatted = toRows(tipTrend30).map((d: unknown) => {
    const row = d as Record<string, unknown>;
    const tips = Number(row.total_tips ?? 0);
    const payments = Number(row.total_payments ?? 0);
    return {
      date: String(row.date ?? '').slice(5, 10),
      totalTips: tips, totalPayments: payments,
      tipRate: payments > 0 ? (tips / payments * 100) : 0,
      txCount: Number(row.tx_count ?? 0),
    };
  });

  // Tip by restaurant
  const cleanName = (v: string | null | undefined) => {
    if (!v) return '—';
    let s = v.replace(/CFS Coffee/ig, '').trim();
    if (s.startsWith('-')) s = s.substring(1).trim();
    const parts = s.split('-').map((p: string) => p.trim()).filter(Boolean);
    return (parts.length > 1 && parts[0].length <= 4) ? parts[1] : parts[0] || v;
  };
  const tipByRestaurantFormatted = tipByRestaurant
    .filter(t => t.totalTips > 0)
    .map(t => ({
      name: cleanName(t.restaurantName),
      totalTips: t.totalTips, totalPayments: t.totalPayments,
      tipRate: t.totalPayments > 0 ? (t.totalTips / t.totalPayments * 100) : 0,
      avgTipPerTx: t.txCount > 0 ? (t.totalTips / t.txCount) : 0,
      txCount: t.txCount,
    }))
    .sort((a, b) => b.tipRate - a.tipRate);

  // MoM
  let momCurr = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
  let momPrev = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
  toRows(momComparison).forEach((d: unknown) => {
    const row = d as Record<string, unknown>;
    const obj = {
      netSales: Number(row.net_sales ?? 0), guests: Number(row.guests ?? 0),
      orders: Number(row.orders ?? 0), discounts: Number(row.discounts ?? 0),
      days: Number(row.days ?? 0),
    };
    if (String(row.period) === 'current') momCurr = obj;
    else momPrev = obj;
  });
  const momSalesChg  = momPrev.netSales > 0 ? ((momCurr.netSales - momPrev.netSales) / momPrev.netSales * 100) : 0;
  const momGuestsChg = momPrev.guests   > 0 ? ((momCurr.guests   - momPrev.guests)   / momPrev.guests   * 100) : 0;

  return {
    lastDate, fromDate, toDate,
    kpisHoy:   kpisPeriod[0] ?? { netSales: 0, grossSales: 0, guests: 0, orders: 0, discounts: 0, voids: 0, refunds: 0 },
    trend90:   trend90Formatted,
    byDow,
    byDiningOption: byDiningOption.filter(d => d.diningOption),
    byOrderSource:  byOrderSource.filter(d => d.orderSource),
    byRevenueCenter: byRevenueCenter.filter(d => d.revenueCenter),
    topDias: topDias.map(d => ({ date: d.date ?? '', netSales: d.netSales, guests: d.guests, orders: d.orders })),
    currWeek, prevWeek, wowSales, wowGuests,
    paymentBreakdown, totalCash, totalCard, totalTips30,
    peakHours,
    tipTrend: tipTrendFormatted,
    tipByRestaurant: tipByRestaurantFormatted,
    momCurr, momPrev, momSalesChg, momGuestsChg,
  };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to   + 'T12:00:00');
  return Math.max(Math.round((b.getTime() - a.getTime()) / 86400000), 0);
}
