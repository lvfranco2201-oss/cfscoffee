import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that are disabled — authenticated users who try to access them get /coming-soon
const COMING_SOON_ROUTES = ['/sucursales', '/inventario', '/clientes', '/productos'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── 1. Public / system routes that always pass through ──────────────────────
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/coming-soon') ||    // allow unauthenticated access
    pathname.startsWith('/api/cron');          // cron jobs don't need session cookie

  // ── 2. Not authenticated ────────────────────────────────────────────────────
  if (!user && !isPublicRoute) {
    // TEMPORARY BYPASS FOR DEBUGGING
    // const url = request.nextUrl.clone();
    // url.pathname = '/login';
    // return NextResponse.redirect(url);
  }

  // ── 3. Authenticated user hitting /login → dashboard ────────────────────────
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // ── 4. Authenticated user hitting a disabled/coming-soon module ─────────────
  if (user && COMING_SOON_ROUTES.some(r => pathname.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = '/coming-soon';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
};
