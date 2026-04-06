import type { Access } from 'payload';

import type { User } from '../../payload-types.ts';

import { resolveUserWorkspaceId } from './workspace-scope.access.ts';

export const canReadOwnWorkspace: Access = ({ req }) => {
  const user = req.user as User | null;

  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  const tenantId = resolveUserWorkspaceId(user);

  if (!tenantId) {
    return false;
  }

  return {
    id: {
      equals: tenantId,
    },
  };
};
