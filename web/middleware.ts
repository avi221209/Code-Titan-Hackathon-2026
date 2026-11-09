import { NextResponse, type NextRequest } from 'next/server';

/**
 * M0 route protection scaffold.
 * Pass-through mode prevents premature auth lockouts before M1 Supabase SSR
 * authentication and workspace membership checks are implemented.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set('x-brandguardian-auth-mode', 'm0-passthrough');
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/knowledge/:path*',
    '/documents/:path*',
    '/login',
  ],
};
