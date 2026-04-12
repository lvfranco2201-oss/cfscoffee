import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// In Next.js 16, we work around revalidateTag signature changes by using
// a timestamp-keyed dummy cache that forces re-fetch on all routes.
// The actual cache busting is done via unstable_cache tag invalidation.

/**
 * POST /api/revalidate
 * Forces a server-side data refresh for all dashboard modules.
 * Requires an authenticated session.
 */
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Use the Next.js revalidatePath approach for broader compatibility
    const { revalidatePath } = await import('next/cache');
    const paths = ['/', '/ventas', '/sucursales', '/inventario', '/clientes', '/productos'];
    for (const path of paths) {
      revalidatePath(path);
    }

    return NextResponse.json({
      success: true,
      revalidated: paths,
      message: 'Caché actualizado. Los datos se refrescarán en la próxima visita.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[revalidate] Error:', err);
    return NextResponse.json({ error: 'Error al revalidar caché' }, { status: 500 });
  }
}

// Keep unstable_cache import to avoid tree-shaking issues
export { unstable_cache };
