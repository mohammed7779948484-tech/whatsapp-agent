import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { env } from '@/core/env';

import { requireOwnerSession } from './require-owner-session';
import { SESSION_COOKIE_NAME } from './constants';
import { verifyWorkspaceSession } from './verify-workspace-session';

function buildAuthRequest(sessionToken: string): Request {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${sessionToken}`);

  return new Request(new URL('/dashboard', env.APP_URL), { headers });
}

export const getOwnerDashboardSession = cache(async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect('/login?redirect=/dashboard');
  }

  try {
    const authRequest = buildAuthRequest(sessionToken);
    const user = await requireOwnerSession(authRequest);
    const workspaceId = await verifyWorkspaceSession(authRequest);

    return { user, workspaceId };
  } catch {
    redirect('/login?redirect=/dashboard');
  }
});
