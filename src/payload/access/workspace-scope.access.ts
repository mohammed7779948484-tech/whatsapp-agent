import type { Access } from 'payload';

import type { User } from '@/payload-types';

export function resolveUserWorkspaceId(user: User | null): number | null {
  const tenantRef = user?.tenants?.[0]?.tenant;

  if (typeof tenantRef === 'number') {
    return tenantRef;
  }

  return typeof tenantRef?.id === 'number' ? tenantRef.id : null;
}

export const workspaceScope: Access = ({ req }) => {
  const user = req.user as User | null;

  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  const workspaceId = resolveUserWorkspaceId(user);

  if (!workspaceId) {
    return false;
  }

  return {
    workspace: {
      equals: workspaceId,
    },
  };
};
