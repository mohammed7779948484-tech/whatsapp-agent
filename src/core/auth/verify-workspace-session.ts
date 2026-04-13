import type { User } from '@/payload-types';
import { AppError, ErrorCode } from '@/core/errors';
import { resolveUserWorkspaceId } from '@/payload/access/workspace-scope.access';
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

  const tenantId = resolveUserWorkspaceId(user);

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
