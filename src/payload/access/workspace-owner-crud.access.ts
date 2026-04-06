import type { Access } from 'payload';

import type { User } from '../../payload-types.ts';

import { resolveUserWorkspaceId } from './workspace-scope.access.ts';

interface WorkspaceData {
  workspace?: unknown;
}

function resolveRelationshipId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relationId = (value as { id?: unknown }).id;
    return typeof relationId === 'number' ? relationId : null;
  }

  return null;
}

export const workspaceOwnerCrud: Access = ({ req, data, id }) => {
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

  const hasWorkspaceField = Boolean(data && typeof data === 'object' && 'workspace' in data);
  const requestedWorkspaceId = hasWorkspaceField
    ? resolveRelationshipId((data as WorkspaceData).workspace)
    : null;

  const isCreateOperation = req.method === 'POST' || Boolean(data);

  if (isCreateOperation && !id) {
    return requestedWorkspaceId === workspaceId;
  }

  if (hasWorkspaceField && requestedWorkspaceId !== workspaceId) {
    return false;
  }

  return {
    workspace: {
      equals: workspaceId,
    },
  };
};
