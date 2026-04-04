import { NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/core/auth/constants';

function decodeRoleFromToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { role?: string };
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/admin')) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const role = decodeRoleFromToken(sessionToken);

    if (!sessionToken || pathname.startsWith('/admin/login')) {
      return NextResponse.next();
    }

    if (role && role !== 'admin') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return NextResponse.next();
}
