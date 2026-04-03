import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/admin')) {
    const sessionToken = request.cookies.get('payload-token');
    
    if (!sessionToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Note: Full admin role verification happens in payload.config.ts admin.access
    // This proxy provides basic session checking at the edge
  }
  
  return NextResponse.next();
}