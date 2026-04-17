import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/schema';
import { asc, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const list = await db
      .select({ id: stores.id, name: stores.name })
      .from(stores)
      .where(sql`${stores.isActive} IS NOT FALSE`)
      .orderBy(asc(stores.name));

    const storeList = list.map(s => ({ id: String(s.id), name: String(s.name) }));

    return NextResponse.json(
      { stores: storeList },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (err) {
    console.error('[API /stores]', err);
    return NextResponse.json({ stores: [] });
  }
}
