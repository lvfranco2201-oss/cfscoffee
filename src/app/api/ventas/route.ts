import { NextRequest, NextResponse } from 'next/server';
import { getVentasMetricsFiltered, DateRange } from '@/lib/services/ventasFiltered';

const VALID_RANGES: DateRange[] = [
  'today', 'yesterday', 'last_7', 'last_30', 'this_month', 'last_month', 'ytd', 'custom',
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

    const data = await getVentasMetricsFiltered({ range, storeId, customFrom, customTo });

    return NextResponse.json(data, {
      // Private: per-user filter combination — cache 5min at browser only
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (err: any) {
    if (err?.message === 'NO_DATA') {
      return NextResponse.json({ error: 'No data available' }, { status: 404 });
    }
    console.error('[API /ventas]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
