import type { User } from '@/payload-types';
import { getSession } from './get-session';
import { AppError, ErrorCode } from '@/core/errors';

export async function requireOwnerSession(req: Request): Promise<User> {
  const user = await getSession(req);
  
  if (!user) {
    throw new AppError(
      'Authentication required',
      ErrorCode.AUTHENTICATION_ERROR,
      401,
      'medium'
    );
  }
  
  if (user.role !== 'owner') {
    throw new AppError(
      'Owner role required',
      ErrorCode.AUTHORIZATION_ERROR,
      403,
      'medium'
    );
  }
  
  return user;
}