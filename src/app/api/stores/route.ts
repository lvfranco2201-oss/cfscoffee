import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const list = await db
      .select({ id: stores.id, name: stores.name, locationName: stores.locationName, isActive: stores.isActive })
      .from(stores)
      .orderBy(asc(stores.name));

    // Return active stores (or all if isActive is null in DB)
    const active = list.filter(s => s.isActive !== false);

    return NextResponse.json(active, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (err) {
    console.error('[API /stores]', err);
    return NextResponse.json([], { status: 200 }); // graceful: return empty array
  }
}
