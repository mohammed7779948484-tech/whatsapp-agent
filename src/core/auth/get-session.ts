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
  } catch (_error) {
    return null;
  }
}
