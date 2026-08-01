import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLogin = path === '/admin/login';
  const requestHeaders = new Headers(request.headers);
  if (isLogin) requestHeaders.set('x-portfolio-admin-login-route', '1');
  else requestHeaders.delete('x-portfolio-admin-login-route');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
