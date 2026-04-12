import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vwDailySalesMetrics, hourlySalesMetrics, paymentData } from '@/lib/db/schema';
import { sum, desc, sql } from 'drizzle-orm';
import type { DateRange } from '@/context/FilterContext';

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
    case 'today':
      fromDate = toDate = lastDate; break;
    case 'yesterday': {
      const d = subtractDays(lastDate, 1);
      fromDate = toDate = d; break;
    }
    case 'last_7':
      fromDate = subtractDays(lastDate, 6); toDate = lastDate; break;
    case 'last_30':
      fromDate = subtractDays(lastDate, 29); toDate = lastDate; break;
    case 'this_month':
      fromDate = lastDate.slice(0, 7) + '-01'; toDate = lastDate; break;
    case 'last_month': {
      const d = new Date(lastDate + 'T12:00:00');
      d.setDate(1); d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
      fromDate = `${y}-${m}-01`;
      toDate = new Date(y, d.getMonth() + 1, 0).toISOString().slice(0, 10);
      break;
    }
    case 'ytd':
      fromDate = lastDate.slice(0, 4) + '-01-01'; toDate = lastDate; break;
    case 'custom':
      fromDate = customFrom ?? lastDate; toDate = customTo ?? lastDate; break;
    default:
      fromDate = toDate = lastDate;
  }
  return { fromDate, toDate };
}

const VALID_RANGES: DateRange[] = [
  'today','yesterday','last_7','last_30','this_month','last_month','ytd','custom'
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get('range') ?? 'today') as DateRange;
    const storeId = searchParams.get('store') ?? 'all';
    const customFrom = searchParams.get('from') ?? undefined;
    const customTo   = searchParams.get('to')   ?? undefined;

    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }

    // 1. Latest date
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);
    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return NextResponse.json({ error: 'No data' }, { status: 404 });

    const { fromDate, toDate } = await resolveRange(range, lastDate, customFrom, customTo);
    const sid = storeId !== 'all' ? parseInt(storeId) : null;
    const storeSQL = sid ? sql`AND ${vwDailySalesMetrics.storeId} = ${sid}` : sql``;
    const hrStoreSQL = sid ? sql`AND ${hourlySalesMetrics.storeId} = ${sid}` : sql``;

    // 2. Parallel queries
    const [kpisRaw, storesRaw, hourlyRaw, paymentRaw, tipRaw, avg30Raw] = await Promise.all([

      // KPIs totales del periodo
      db.select({
        totalNetSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        totalGrossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        totalGuests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        totalOrders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        totalDiscounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
        totalVoids:      sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
        totalRefunds:    sum(vwDailySalesMetrics.totalRefunds).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${storeSQL}`),

      // Desglose por sucursal
      db.select({
        storeId:    vwDailySalesMetrics.storeId,
        storeName:  vwDailySalesMetrics.storeName,
        netSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        grossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        guests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
        voids:      sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
        refunds:    sum(vwDailySalesMetrics.totalRefunds).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${storeSQL}`)
      .groupBy(vwDailySalesMetrics.storeId, vwDailySalesMetrics.storeName)
      .orderBy(desc(sum(vwDailySalesMetrics.totalNetSales))),

      // Curva horaria agregada
      db.select({
        hour:     hourlySalesMetrics.businessHour,
        netSales: sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        guests:   sum(hourlySalesMetrics.guestCount).mapWith(Number),
        orders:   sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
        laborHrs:  sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalHours}), 0)`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date ${hrStoreSQL}`)
      .groupBy(hourlySalesMetrics.businessHour)
      .orderBy(hourlySalesMetrics.businessHour),

      // Métodos de pago del periodo
      db.select({
        methodType:  paymentData.paymentCardType,
        totalAmount: sum(paymentData.paymentTotal).mapWith(Number),
      })
      .from(paymentData)
      .where(sql`TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') BETWEEN ${fromDate}::date AND ${toDate}::date`)
      .groupBy(paymentData.paymentCardType),

      // Tips del periodo
      db.select({ total: sum(paymentData.tipAmount).mapWith(Number) })
        .from(paymentData)
        .where(sql`TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') BETWEEN ${fromDate}::date AND ${toDate}::date`),

      // Promedio 30d (siempre desde lastDate hacia atrás, para anomalías)
      db.execute(sql`
        SELECT
          AVG(daily_net)::float    AS "avgNetSales",
          AVG(daily_guests)::float AS "avgGuests",
          AVG(daily_orders)::float AS "avgOrders"
        FROM (
          SELECT
            ${vwDailySalesMetrics.businessDate}::date        AS d,
            SUM(${vwDailySalesMetrics.totalNetSales})::float AS daily_net,
            SUM(${vwDailySalesMetrics.totalGuests})::float   AS daily_guests,
            SUM(${vwDailySalesMetrics.totalOrders})::float   AS daily_orders
          FROM ${vwDailySalesMetrics}
          WHERE ${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '30 days')
            AND ${vwDailySalesMetrics.businessDate}::date < ${lastDate}::date
          GROUP BY ${vwDailySalesMetrics.businessDate}::date
        ) sub
      `),
    ]);

    // ── Post-process ────────────────────────────────────────────────────────
    const toRows = (res: unknown) =>
      Array.isArray(res) ? res as Record<string, unknown>[]
      : ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];

    // avg30
    const avg30Row = toRows(avg30Raw)[0] ?? {};
    const avg30 = {
      avgNetSales: Number(avg30Row.avgNetSales ?? 0),
      avgGuests:   Number(avg30Row.avgGuests ?? 0),
      avgOrders:   Number(avg30Row.avgOrders ?? 0),
    };

    // Curva horaria
    const totalLaborCost  = hourlyRaw.reduce((a, d) => a + (d.laborCost ?? 0), 0);
    const totalLaborHours = hourlyRaw.reduce((a, d) => a + (d.laborHrs  ?? 0), 0);
    const peakHours = hourlyRaw
      .filter(d => d.netSales > 0)
      .map(d => {
        const h = d.hour ?? 0, ampm = h >= 12 ? 'PM' : 'AM', hr = h % 12 || 12;
        return { time: `${String(hr).padStart(2,'0')}:00 ${ampm}`, ventas: d.netSales, clientes: d.guests, ordenes: d.orders, labor: d.laborCost };
      });

    // Payment methods
    let totalCash = 0, totalCard = 0;
    paymentRaw.forEach(p => {
      const type = (p.methodType ?? '').toUpperCase();
      if (type === 'CASH' || type.includes('CASH')) totalCash += p.totalAmount;
      else totalCard += p.totalAmount;
    });
    const paymentMethods = [
      { name: 'Tarjeta / Digital', value: totalCard, color: 'var(--cfs-gold)' },
      { name: 'Efectivo',          value: totalCash, color: 'var(--info)' },
    ].filter(p => p.value > 0);

    const storesPerformance = storesRaw.map(s => ({
      ...s,
      storeName: s.storeName ?? 'Desconocida',
    }));

    return NextResponse.json({
      lastDate, fromDate, toDate,
      kpis: kpisRaw[0] ?? null,
      storesPerformance,
      peakHours,
      paymentMethods,
      totalTips: tipRaw[0]?.total ?? 0,
      totalLaborCost,
      totalLaborHours,
      avg30,
    }, {
      // Private: each filter combination is user-specific; cache 5min at browser level only
      headers: { 'Cache-Control': 'private, max-age=300' },
    });

  } catch (err) {
    console.error('[API /dashboard]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
