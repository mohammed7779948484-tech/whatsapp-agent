import type { Access } from 'payload';

import type { User } from '../../payload-types.ts';

function resolveWorkspaceRefId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relationId = (value as { id?: unknown }).id;
    return typeof relationId === 'number' ? relationId : null;
  }

  return null;
}

export function resolveUserWorkspaceId(user: User | null): number | null {
  const pluginTenantRef = user?.tenant;

  const pluginTenantId = resolveWorkspaceRefId(pluginTenantRef);

  if (pluginTenantId) {
    return pluginTenantId;
  }

  const tenantRef = user?.tenants?.[0]?.tenant;

  return resolveWorkspaceRefId(tenantRef);
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
