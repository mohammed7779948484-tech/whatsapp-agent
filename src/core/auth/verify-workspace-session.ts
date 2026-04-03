import type { User } from '@/payload-types';
import { AppError, ErrorCode } from '@/core/errors';
import { getSession } from './get-session';

export async function verifyWorkspaceSession(req: Request): Promise<string> {
  const user = (await getSession(req)) as User | null;

  if (!user) {
    throw new AppError(
      'Authentication required',
      ErrorCode.AUTHENTICATION_ERROR,
      401,
      'medium'
    );
  }

  const tenantRef = user.tenants?.[0]?.tenant;
  const tenantId = typeof tenantRef === 'number' ? tenantRef : tenantRef?.id;

  if (!tenantId) {
    throw new AppError(
      'User does not have an associated workspace',
      ErrorCode.AUTHORIZATION_ERROR,
      403,
      'medium'
    );
  }

  return String(tenantId);
}
