import type { CollectionBeforeChangeHook } from 'payload';

import { AppError } from '@/core/errors/app-error';
import { ErrorCode } from '@/core/errors/error-codes';

type OnePerWorkspaceCollectionSlug = 'agents' | 'whatsapp_sessions';

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

export const enforceOnePerWorkspace = (
  collectionSlug: OnePerWorkspaceCollectionSlug
): CollectionBeforeChangeHook => {
  return async ({ data, operation, req }) => {
    if (operation !== 'create') {
      return data;
    }

    const workspaceId = resolveRelationshipId((data as WorkspaceData | undefined)?.workspace);

    if (!workspaceId) {
      return data;
    }

    const existingRecords = await req.payload.find({
      collection: collectionSlug as never,
      where: {
        workspace: {
          equals: workspaceId,
        },
      },
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
