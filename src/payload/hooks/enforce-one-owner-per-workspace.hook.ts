import type { CollectionBeforeChangeHook } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

interface WorkspaceLike {
  id?: unknown;
}

interface WorkspaceData {
  id?: unknown;
  owner?: unknown;
}

interface UserRecord {
  role?: 'admin' | 'owner';
  tenant?: unknown;
  tenants?: { tenant?: unknown }[] | null;
}

function resolveRelationshipId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relationId = (value as WorkspaceLike).id;
    return typeof relationId === 'number' ? relationId : null;
  }

  return null;
}

export const enforceOneOwnerPerWorkspace: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const workspaceId = resolveRelationshipId((originalDoc as WorkspaceData | undefined)?.id);
  const nextOwnerId = resolveRelationshipId((data as WorkspaceData | undefined)?.owner);
  const currentOwnerId = resolveRelationshipId((originalDoc as WorkspaceData | undefined)?.owner);

  if (!nextOwnerId || nextOwnerId === currentOwnerId) {
    return data;
  }

  const ownerUser = (await req.payload.findByID({
    collection: 'users',
    id: nextOwnerId,
    depth: 0,
    overrideAccess: true,
    req,
  })) as UserRecord;

  const ownerTenantId =
    resolveRelationshipId(ownerUser.tenant) ?? resolveRelationshipId(ownerUser.tenants?.[0]?.tenant);

  if (ownerUser.role !== 'owner' || (workspaceId && ownerTenantId !== workspaceId)) {
    throw new AppError(
      'Workspace owner must be an owner user assigned to this workspace',
      ErrorCode.OWNER_ALREADY_ASSIGNED,
      409
    );
  }

  const originalWorkspaceId =
    originalDoc && typeof originalDoc === 'object' && 'id' in originalDoc
      ? resolveRelationshipId((originalDoc as { id?: unknown }).id)
      : null;

  const existingOwnerWorkspace = await req.payload.find({
    collection: 'workspaces',
    where: {
      and: [
        {
          owner: {
            equals: nextOwnerId,
          },
        },
        ...(originalWorkspaceId
          ? [
              {
                id: {
                  not_equals: originalWorkspaceId,
                },
              },
            ]
          : []),
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  });

  if (existingOwnerWorkspace.docs.length > 0) {
    throw new AppError(
      'This user is already the owner of another workspace',
      ErrorCode.OWNER_ALREADY_ASSIGNED,
      409
    );
  }

  return data;
};
