import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { proxy } from '../../proxy';

function createJwt(role: string) {
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `header.${payload}.signature`;
}

describe('proxy admin routing', () => {
  it('allows anonymous access to the admin login screen', async () => {
    const request = new NextRequest('http://localhost:3000/admin/login');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it('redirects owner sessions away from admin routes', async () => {
    const request = new NextRequest('http://localhost:3000/admin/collections/users', {
      headers: {
        cookie: `payload-token=${createJwt('owner')}`,
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?redirect=%2Fadmin%2Fcollections%2Fusers');
  });
});
