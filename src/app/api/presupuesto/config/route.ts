import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/presupuesto/config?year=YYYY&month=MM
 * Returns all active stores with their current budget for the requested month.
 * Used exclusively by the budget edit modal.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));

  try {
    // 1. All active stores from Aurora
    const storeList = await db
      .select({ id: stores.id, name: stores.name, locationCode: stores.locationCode })
      .from(stores)
      .where(sql`${stores.isActive} IS NOT FALSE`)
      .orderBy(sql`${stores.name} ASC`);

    // 2. Existing budgets for this month from Supabase
    let existingBudgets: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('store_budgets')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (error && error.code !== 'PGRST205') throw error;
      existingBudgets = data ?? [];
    } catch {
      existingBudgets = [];
    }

    const budgetMap = new Map(existingBudgets.map((b: any) => [b.store_id, b]));

    // 3. Merge: every active store gets a row (with or without existing budget)
    const rows = storeList.map(s => {
      const existing = budgetMap.get(s.id) as any;
      return {
        storeId:      s.id,
        storeName:    s.name,
        locationCode: s.locationCode,
        salesTarget:  existing?.sales_target  != null ? parseFloat(existing.sales_target)  : null,
        laborCostPct: existing?.labor_cost_pct != null ? parseFloat(existing.labor_cost_pct) : null,
        notes:        existing?.notes ?? '',
        hasBudget:    !!existing,
      };
    });

    const daysInMonth = new Date(year, month, 0).getDate();

    return NextResponse.json({ year, month, daysInMonth, rows });
  } catch (err) {
    console.error('[API /presupuesto/config GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
