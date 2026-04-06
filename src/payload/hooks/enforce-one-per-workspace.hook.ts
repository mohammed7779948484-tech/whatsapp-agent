import type { CollectionBeforeChangeHook, Where } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

type OnePerWorkspaceCollectionSlug = 'agents' | 'whatsapp_sessions';

interface WorkspaceData {
  workspace?: unknown;
  id?: unknown;
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

export const enforceOnePerWorkspace = (
  collectionSlug: OnePerWorkspaceCollectionSlug
): CollectionBeforeChangeHook => {
  return async ({ data, operation, originalDoc, req }) => {
    const incomingWorkspaceId = resolveRelationshipId((data as WorkspaceData | undefined)?.workspace);
    const originalWorkspaceId = resolveRelationshipId((originalDoc as WorkspaceData | undefined)?.workspace);
    const originalDocId = resolveRelationshipId((originalDoc as WorkspaceData | undefined)?.id);

    const shouldValidateCreate = operation === 'create';
    const shouldValidateWorkspaceChange =
      operation === 'update' && Boolean(incomingWorkspaceId) && incomingWorkspaceId !== originalWorkspaceId;

    if (!shouldValidateCreate && !shouldValidateWorkspaceChange) {
      return data;
    }

    const workspaceId = incomingWorkspaceId;

    if (!workspaceId) {
      return data;
    }

    const where: Where = shouldValidateWorkspaceChange && originalDocId
      ? {
          and: [
            {
              workspace: {
                equals: workspaceId,
              },
            } as Where,
            {
              id: {
                not_equals: originalDocId,
              },
            } as Where,
          ],
        }
      : {
          workspace: {
            equals: workspaceId,
          },
        };

    const existingRecords = await req.payload.find({
      collection: collectionSlug as never,
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    if (existingRecords.docs.length > 0) {
      throw new AppError(
        `Only one ${collectionSlug} is allowed per workspace`,
        ErrorCode.DUPLICATE_RESOURCE,
        409
      );
    }

    return data;
  };
};
