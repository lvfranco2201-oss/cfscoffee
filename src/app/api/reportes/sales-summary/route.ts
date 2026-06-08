import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyConsolidatedMetrics, stores } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
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
    const storeIdParam = searchParams.get('store') ?? 'all';
    const customFrom = searchParams.get('from') ?? undefined;
    const customTo   = searchParams.get('to')   ?? undefined;

    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }

    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${dailyConsolidatedMetrics.businessDate}::date)` })
      .from(dailyConsolidatedMetrics);
    
    // Fallback date si no hay datos
    const lastDate = latestRes[0]?.latestDate ?? new Date().toISOString().slice(0, 10);

    const { fromDate, toDate } = await resolveRange(range, lastDate, customFrom, customTo);
    
    // Build where clause
    let whereClause = sql`${dailyConsolidatedMetrics.businessDate}::date BETWEEN ${fromDate}::date AND ${toDate}::date`;
    if (storeIdParam !== 'all') {
      const sid = parseInt(storeIdParam, 10);
      if (!isNaN(sid)) {
        whereClause = sql`${whereClause} AND ${dailyConsolidatedMetrics.storeId} = ${sid}`;
      }
    }

    const rawData = await db
      .select({
        date: dailyConsolidatedMetrics.businessDate,
        netSales: sql<number>`SUM(${dailyConsolidatedMetrics.netSales}::numeric)`,
        tax: sql<number>`SUM(${dailyConsolidatedMetrics.tax}::numeric)`,
        tips: sql<number>`SUM(${dailyConsolidatedMetrics.tips}::numeric)`,
        creditDebit: sql<number>`SUM(
          COALESCE(${dailyConsolidatedMetrics.visaPayments}::numeric, 0) + 
          COALESCE(${dailyConsolidatedMetrics.mastercardPayments}::numeric, 0) + 
          COALESCE(${dailyConsolidatedMetrics.amexPayments}::numeric, 0)
        )`,
        cash: sql<number>`SUM(${dailyConsolidatedMetrics.cashPayments}::numeric)`,
        otherPayments: sql<number>`SUM(${dailyConsolidatedMetrics.otherPayments}::numeric)`,
        discounts: sql<number>`SUM(${dailyConsolidatedMetrics.discounts}::numeric)`,
        voids: sql<number>`SUM(${dailyConsolidatedMetrics.voids}::numeric + ${dailyConsolidatedMetrics.refunds}::numeric)`,
        laborHours: sql<number>`SUM(${dailyConsolidatedMetrics.laborHours}::numeric)`,
        laborCost: sql<number>`SUM(${dailyConsolidatedMetrics.laborCost}::numeric)`,
      })
      .from(dailyConsolidatedMetrics)
      .where(whereClause)
      .groupBy(dailyConsolidatedMetrics.businessDate)
      .orderBy(dailyConsolidatedMetrics.businessDate);

    // Formateo los resultados asegurando números
    const data = rawData.map(row => {
      // Postgres dates may come as objects or strings.
      const dStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0,10);
      
      const parts = dStr.split('-');
      const jsDate = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
      const dayOfWeek = jsDate.toLocaleDateString('en-US', { weekday: 'long' });

      return {
        date: dStr,
        dayNumber: Number(parts[2]),
        dayOfWeek,
        netSales: Number(row.netSales || 0),
        tax: Number(row.tax || 0),
        tips: Number(row.tips || 0),
        creditDebit: Number(row.creditDebit || 0),
        cash: Number(row.cash || 0),
        otherPayments: Number(row.otherPayments || 0),
        discounts: Number(row.discounts || 0),
        voids: Number(row.voids || 0),
        laborHours: Number(row.laborHours || 0),
        laborCost: Number(row.laborCost || 0),
      };
    });

    const storesCatalogRaw = await db
      .select({ id: stores.id, name: stores.name })
      .from(stores)
      .where(sql`${stores.isActive} IS NOT FALSE`);

    const availableStores = storesCatalogRaw.map((s) => ({ id: String(s.id), name: String(s.name) }));

    return NextResponse.json({
      lastDate, fromDate, toDate,
      data,
      availableStores,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' }
    });

  } catch (err) {
    console.error('[API /reportes/sales-summary]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
