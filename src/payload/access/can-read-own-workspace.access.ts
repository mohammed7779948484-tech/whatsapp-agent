import type { Access } from 'payload';

import type { User } from '../../payload-types.ts';

export const canReadOwnWorkspace: Access = ({ req }) => {
  const user = req.user as User | null;

  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  const tenantRef = user.tenants?.[0]?.tenant;
  const tenantId = typeof tenantRef === 'number' ? tenantRef : tenantRef?.id;

  if (!tenantId) {
    return false;
  }

  return {
    id: {
      equals: tenantId,
    },
  };
};
