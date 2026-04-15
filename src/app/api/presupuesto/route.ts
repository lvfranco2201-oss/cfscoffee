import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db';
import { dailyConsolidatedMetrics, vwDailySalesMetrics, hourlySalesMetrics, stores } from '@/lib/db/schema';
import { sql, and, eq } from 'drizzle-orm';
import { sum } from 'drizzle-orm';


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Date resolution (same logic as dashboard) ──────────────────────────────────

async function resolveRange(range: string, customFrom: string, customTo: string): Promise<{ from: string; to: string }> {
  // Always anchor on the latest businessDate in the DB
  const latestRes = await db
    .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
    .from(vwDailySalesMetrics);

  const lastDateStr = latestRes[0]?.latestDate;
  if (!lastDateStr) {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const s = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return { from: s, to: s };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  // Use lastDateStr as the anchor 'today'
  const today = new Date(lastDateStr + 'T12:00:00');

  switch (range) {
    case 'today': {
      const s = fmt(today);
      return { from: s, to: s };
    }
    case 'yesterday': {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      const s = fmt(d); return { from: s, to: s };
    }
    case 'last_7': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { from: fmt(d), to: fmt(today) };
    }
    case 'last_30': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { from: fmt(d), to: fmt(today) };
    }
    case 'this_month': {
      const from = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
      return { from, to: fmt(today) };
    }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case 'ytd': {
      const from = `${today.getFullYear()}-01-01`;
      return { from, to: fmt(today) };
    }
    case 'custom': {
      if (customFrom && customTo) return { from: customFrom, to: customTo };
      const s = fmt(today); return { from: s, to: s };
    }
    default: {
      const s = fmt(today); return { from: s, to: s };
    }
  }
}

// ── Pro-rate budget for a date range (handles multi-month) ────────────────────
// Returns sum of (monthly_target / days_in_month) * days_in_range_for_that_month

interface MonthBudget {
  year: number;
  month: number;
  salesTarget: number;
  laborCostPct: number;
}

function prorateForRange(
  from: string,
  to: string,
  monthBudgets: MonthBudget[]
): { proratedSales: number; proratedLaborAmt: number } {
  const budgetMap = new Map(monthBudgets.map(b => [`${b.year}-${b.month}`, b]));

  const fromDate = new Date(from + 'T12:00:00');
  const toDate   = new Date(to   + 'T12:00:00');

  // Iterate day by day and accumulate pro-rated budget
  let proratedSales     = 0;
  let proratedLaborFrac = 0; // sum of (labor_pct / 100) weighted by sales_per_day

  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const key = `${y}-${m}`;
    const budget = budgetMap.get(key);

    if (budget && budget.salesTarget > 0) {
      const daysInMonth = new Date(y, m, 0).getDate(); // day 0 trick
      const dailySales = budget.salesTarget / daysInMonth;
      proratedSales     += dailySales;
      proratedLaborFrac += (dailySales * (budget.laborCostPct / 100));
    }

    cur.setDate(cur.getDate() + 1);
  }

  return { proratedSales, proratedLaborAmt: proratedLaborFrac };
}

// ── GET /api/presupuesto?range=...&store=...&from=...&to=... ──────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range      = searchParams.get('range')     ?? 'today';
  const storeParam = searchParams.get('store')     ?? 'all';
  const customFrom = searchParams.get('from')      ?? '';
  const customTo   = searchParams.get('to')        ?? '';

  const { from, to } = await resolveRange(range, customFrom, customTo);

  // Determine the set of months the range spans (for fetching budgets)
  const fromDate = new Date(from + 'T12:00:00');
  const toDate   = new Date(to   + 'T12:00:00');
  const monthSet: { year: number; month: number }[] = [];
  const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (cur <= toDate) {
    monthSet.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }

  try {
    // 1. Active stores from Aurora — include stores where isActive is TRUE or NULL
    const storeList = await db
      .select({ id: stores.id, name: stores.name, locationCode: stores.locationCode })
      .from(stores)
      .where(sql`${stores.isActive} IS NOT FALSE`)
      .orderBy(sql`${stores.name} ASC`);

    // 2. Fetch all budgets for the months in range from Supabase
    let allBudgets: any[] = [];
    try {
      let budgetQuery = supabaseAdmin
        .from('store_budgets')
        .select('*');

      // Build OR filter for each year-month combination
      if (monthSet.length === 1) {
        budgetQuery = budgetQuery.eq('year', monthSet[0].year).eq('month', monthSet[0].month);
      } else {
        const orFilter = monthSet.map(m => `and(year.eq.${m.year},month.eq.${m.month})`).join(',');
        budgetQuery = budgetQuery.or(orFilter);
      }

      const { data, error: budgetErr } = await budgetQuery;
      // If table doesn't exist yet (PGRST205), return empty — don't crash
      if (budgetErr && budgetErr.code !== 'PGRST205') throw budgetErr;
      allBudgets = data ?? [];
    } catch (sbErr: any) {
      if (!String(sbErr?.message ?? '').includes('store_budgets')) throw sbErr;
      // table not yet created — treat as no budgets
      allBudgets = [];
    }

    // 3. Actual sales from Aurora for the exact date range
    // Primary: vwDailySalesMetrics (view) + hourlySalesMetrics for labor
    // Fallback: DailyConsolidatedMetrics (if the view doesn't exist)
    let actualSales: { storeId: number | null; netSales: number; laborCost: number }[] = [];
    try {
      // Net sales from the view
      const salesRows = await db
        .select({
          storeId:  vwDailySalesMetrics.storeId,
          netSales: sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        })
        .from(vwDailySalesMetrics)
        .where(
          and(
            sql`${vwDailySalesMetrics.businessDate}::date >= ${from}::date`,
            sql`${vwDailySalesMetrics.businessDate}::date <= ${to}::date`,
            ...(storeParam !== 'all' ? [eq(vwDailySalesMetrics.storeId, parseInt(storeParam))] : [])
          )
        )
        .groupBy(vwDailySalesMetrics.storeId);

      // Labor cost from hourly metrics
      const laborRows = await db
        .select({
          storeId:   hourlySalesMetrics.storeId,
          laborCost: sql<number>`COALESCE(SUM(${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
        })
        .from(hourlySalesMetrics)
        .where(
          and(
            sql`${hourlySalesMetrics.businessDate}::date >= ${from}::date`,
            sql`${hourlySalesMetrics.businessDate}::date <= ${to}::date`,
            ...(storeParam !== 'all' ? [eq(hourlySalesMetrics.storeId, parseInt(storeParam))] : [])
          )
        )
        .groupBy(hourlySalesMetrics.storeId);

      const laborMap = new Map(laborRows.map(l => [l.storeId, l.laborCost]));
      actualSales = salesRows.map(s => ({
        storeId:   s.storeId,
        netSales:  s.netSales ?? 0,
        laborCost: laborMap.get(s.storeId ?? -1) ?? 0,
      }));
    } catch {
      // Fallback to DailyConsolidatedMetrics if view doesn't exist
      try {
        const fallback = await db
          .select({
            storeId:   dailyConsolidatedMetrics.storeId,
            netSales:  sum(dailyConsolidatedMetrics.netSales).mapWith(Number),
            laborCost: sum(dailyConsolidatedMetrics.laborCost).mapWith(Number),
          })
          .from(dailyConsolidatedMetrics)
          .where(
            and(
              sql`${dailyConsolidatedMetrics.businessDate} >= ${from}::date`,
              sql`${dailyConsolidatedMetrics.businessDate} <= ${to}::date`,
              ...(storeParam !== 'all' ? [eq(dailyConsolidatedMetrics.storeId, parseInt(storeParam))] : [])
            )
          )
          .groupBy(dailyConsolidatedMetrics.storeId);
        actualSales = fallback.map(f => ({ storeId: f.storeId, netSales: f.netSales ?? 0, laborCost: f.laborCost ?? 0 }));
      } catch { actualSales = []; }
    }


    // 4. Build per-store map
    // budgets: storeId → array of month budgets
    const budgetsByStore = new Map<number, MonthBudget[]>();
    for (const b of allBudgets ?? []) {
      const existing = budgetsByStore.get(b.store_id) ?? [];
      existing.push({
        year:         b.year,
        month:        b.month,
        salesTarget:  parseFloat(b.sales_target  ?? '0'),
        laborCostPct: parseFloat(b.labor_cost_pct ?? '30'),
      });
      budgetsByStore.set(b.store_id, existing);
    }

    const actualMap = new Map(actualSales.map(a => [a.storeId, a]));

    // 5. Merge per store
    const rows = storeList
      .filter(s => storeParam === 'all' || String(s.id) === storeParam)
      .map(store => {
        const monthBudgets = budgetsByStore.get(store.id) ?? [];
        const actual       = actualMap.get(store.id);

        const { proratedSales, proratedLaborAmt } = prorateForRange(from, to, monthBudgets);

        const actualNetSales  = actual?.netSales    ?? 0;
        const actualLaborCost = actual?.laborCost   ?? 0;

        const hasAnyBudget    = monthBudgets.length > 0 && proratedSales > 0;
        const salesAchievePct = hasAnyBudget ? (actualNetSales / proratedSales) * 100 : null;
        const salesVariance   = hasAnyBudget ? actualNetSales - proratedSales         : null;

        const actualLaborPct  = actualNetSales > 0
          ? (actualLaborCost / actualNetSales) * 100 : null;
        const budgetLaborPct  = monthBudgets.length > 0
          ? monthBudgets[monthBudgets.length - 1].laborCostPct : null; // last month in range

        return {
          storeId:           store.id,
          storeName:         store.name,
          locationCode:      store.locationCode,
          // Actuals
          actualNetSales,
          actualLaborCost,
          actualLaborPct,
          // Pro-rated budget for the period
          proratedSalesBudget: hasAnyBudget ? proratedSales    : null,
          proratedLaborBudget: hasAnyBudget ? proratedLaborAmt : null,
          budgetLaborPct,
          // KPIs
          salesAchievementPct: salesAchievePct,
          salesVariance,
          // Raw monthly budgets (for edit UI)
          monthBudgets,
        };
      });

    // 6. Totals
    const totalActual     = rows.reduce((s, r) => s + r.actualNetSales, 0);
    const totalBudget     = rows.reduce((s, r) => s + (r.proratedSalesBudget ?? 0), 0);
    const totalLaborCost  = rows.reduce((s, r) => s + r.actualLaborCost, 0);
    const overallAchieve  = totalBudget > 0 ? (totalActual / totalBudget) * 100 : null;
    const overallLaborPct = totalActual  > 0 ? (totalLaborCost / totalActual) * 100 : null;

    return NextResponse.json({
      from, to, range,
      rows,
      totals: { totalActual, totalBudget, totalLaborCost, overallAchieve, overallLaborPct },
      monthsInRange: monthSet,
      hasBudgetData: (allBudgets?.length ?? 0) > 0,
      availableStores: storeList.map(s => ({ id: String(s.id), name: s.name })),
    });

  } catch (err) {
    console.error('[API /presupuesto GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST /api/presupuesto  (upsert budget rows) ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: any[] = body.rows ?? [];
    if (rows.length === 0) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

    const payload = rows.map(r => ({
      store_id:       r.storeId,
      store_name:     r.storeName,
      year:           r.year,
      month:          r.month,
      sales_target:   r.salesTarget   ?? 0,
      labor_cost_pct: r.laborCostPct  ?? 30,
      notes:          r.notes         ?? '',
    }));

    const { error } = await supabaseAdmin
      .from('store_budgets')
      .upsert(payload, { onConflict: 'store_id,year,month' });

    if (error) throw error;

    return NextResponse.json({ ok: true, savedCount: rows.length });
  } catch (err) {
    console.error('[API /presupuesto POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
