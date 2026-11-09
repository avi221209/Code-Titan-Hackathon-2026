import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthRoute, isProtectedPath } from '@/lib/validators/m1';

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Always verify session integrity via getUser() rather than trusting cookie claims alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedPath(pathname) && !user) {
    const redirectResponse = NextResponse.redirect(
      new URL('/login', request.url)
    );
    return copyCookies(supabaseResponse, redirectResponse);
  }

  if (isAuthRoute(pathname) && user) {
    const redirectResponse = NextResponse.redirect(
      new URL('/dashboard', request.url)
    );
    return copyCookies(supabaseResponse, redirectResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/:path*',
    '/knowledge/:path*',
    '/documents/:path*',
  ],
};
