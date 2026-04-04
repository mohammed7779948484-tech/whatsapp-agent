import type { CollectionBeforeChangeHook } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

interface WorkspaceLike {
  id?: unknown;
}

interface WorkspaceData {
  owner?: unknown;
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
  const nextOwnerId = resolveRelationshipId((data as WorkspaceData | undefined)?.owner);
  const currentOwnerId = resolveRelationshipId((originalDoc as WorkspaceData | undefined)?.owner);

  if (!nextOwnerId || nextOwnerId === currentOwnerId) {
    return data;
  }

  const existingOwnerWorkspace = await req.payload.find({
    collection: 'workspaces',
    where: {
      and: [
        {
          owner: {
            equals: nextOwnerId,
          },
        },
        ...(originalDoc && 'id' in originalDoc
          ? [
              {
                id: {
                  not_equals: Number((originalDoc as { id?: unknown }).id),
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
