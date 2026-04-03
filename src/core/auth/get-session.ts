import type { User } from '@/payload-types';
import { getPayloadClient } from '@/payload/lib/get-payload';

export async function getSession(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization');
  const sessionToken = authHeader?.replace('Bearer ', '') || null;
  
  if (!sessionToken) {
    return null;
  }
  
  try {
    const payload = await getPayloadClient();
    const headers = new Headers();
    headers.set('authorization', `Bearer ${sessionToken}`);
    
    const result = await payload.auth({
      headers,
    });
    
    if (result.user) {
      return result.user as unknown as User;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export function getSessionCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const cookies = document.cookie.split(';');
  const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('payload-token='));
  
  if (!sessionCookie) {
    return null;
  }
  
  return sessionCookie.split('=')[1]?.trim() || null;
}