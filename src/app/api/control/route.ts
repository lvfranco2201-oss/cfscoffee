import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vwDailySalesMetrics, hourlySalesMetrics, paymentData, stores } from '@/lib/db/schema';
import { sum, sql, desc } from 'drizzle-orm';
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

    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);
    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return NextResponse.json({ error: 'No data' }, { status: 404 });

    const { fromDate, toDate } = await resolveRange(range, lastDate, customFrom, customTo);
    const sid = storeId !== 'all' ? parseInt(storeId) : null;
    const storeSQL = sid ? sql`AND ${vwDailySalesMetrics.storeId} = ${sid}` : sql``;
    const hrStoreSQL = sid ? sql`AND ${hourlySalesMetrics.storeId} = ${sid}` : sql``;

    // Parallel queries per store
    const [salesRaw, laborRaw, paymentRaw, storesCatalogRaw] = await Promise.all([
      // Sales & Transactions
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
      .groupBy(vwDailySalesMetrics.storeId, vwDailySalesMetrics.storeName),

      // Labor per store
      db.execute(sql`
        SELECT
          store_id,
          SUM(labor_cost) AS "laborCost",
          SUM(labor_hrs) AS "laborHrs"
        FROM (
          SELECT
            ${hourlySalesMetrics.storeId} AS store_id,
            ${hourlySalesMetrics.businessDate} AS bdate,
            ${hourlySalesMetrics.businessHour} AS bhour,
            MAX(${hourlySalesMetrics.hourlyJobTotalPay}) AS labor_cost,
            MAX(${hourlySalesMetrics.hourlyJobTotalHours}) AS labor_hrs
          FROM ${hourlySalesMetrics}
          WHERE ${hourlySalesMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date
            ${hrStoreSQL}
          GROUP BY ${hourlySalesMetrics.storeId}, ${hourlySalesMetrics.businessDate}, ${hourlySalesMetrics.businessHour}
        ) sub
        GROUP BY store_id
      `),

      // Payments (Cash vs Card + Tips) per restaurant string
      db.select({
        restaurantName: paymentData.restaurantName,
        methodType:     paymentData.paymentCardType,
        paymentTotal:   sum(paymentData.paymentTotal).mapWith(Number),
        tipAmount:      sum(paymentData.tipAmount).mapWith(Number),
      })
      .from(paymentData)
      .where(sql`${paymentData.settledDate}::text >= REPLACE(${fromDate}, '-', '') AND ${paymentData.settledDate}::text <= REPLACE(${toDate}, '-', '')`)
      .groupBy(paymentData.restaurantName, paymentData.paymentCardType),

      // Catalog
      db.select({ id: stores.id, name: stores.name })
        .from(stores)
        .where(sql`${stores.isActive} IS NOT FALSE`)
    ]);

    const toRows = (res: unknown) =>
      Array.isArray(res) ? res as Record<string, unknown>[]
      : ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];

    const laborRows = toRows(laborRaw);
    
    // Map labor and payments by store
    const storeMap = new Map<number, any>();
    
    for (const s of salesRaw) {
      if (s.storeId) {
        storeMap.set(s.storeId, {
          ...s,
          storeName: s.storeName ?? 'Desconocida',
          laborCost: 0,
          laborHrs: 0,
          cashSales: 0,
          cardSales: 0,
          tips: 0
        });
      }
    }

    // Add labor
    for (const r of laborRows) {
      const sid = Number(r.store_id);
      if (storeMap.has(sid)) {
        const sm = storeMap.get(sid);
        sm.laborCost = Number(r.laborCost ?? 0);
        sm.laborHrs = Number(r.laborHrs ?? 0);
      }
    }

    // Add payments
    for (const p of paymentRaw) {
      const rName = (p.restaurantName ?? '').toLowerCase();
      // fuzzy match to store
      const storeIdMatches = [...storeMap.entries()].filter(([id, data]) => {
         return data.storeName.toLowerCase().includes(rName) || rName.includes(data.storeName.toLowerCase());
      });
      if (storeIdMatches.length > 0) {
        const sm = storeIdMatches[0][1];
        const type = (p.methodType ?? '').toUpperCase();
        if (type === 'CASH' || type.includes('CASH') || type === 'EFECTIVO') {
           sm.cashSales += p.paymentTotal;
        } else {
           sm.cardSales += p.paymentTotal;
        }
        // tips can be summed independently
        sm.tips += p.tipAmount;
      }
    }

    const finalData = Array.from(storeMap.values()).sort((a,b) => b.netSales - a.netSales);

    return NextResponse.json({
      lastDate, fromDate, toDate,
      data: finalData,
      availableStores: toRows(storesCatalogRaw).map((s: any) => ({ id: String(s.id), name: String(s.name) })),
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' }
    });

  } catch (err) {
    console.error('[API /control]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
