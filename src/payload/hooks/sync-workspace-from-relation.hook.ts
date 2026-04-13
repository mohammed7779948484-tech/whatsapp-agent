import type { CollectionBeforeChangeHook } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

type SupportedRelationCollection = 'conversations' | 'knowledge_files';

interface RelationshipValue {
  id?: unknown;
  workspace?: unknown;
}

interface DataWithWorkspace {
  workspace?: unknown;
  [key: string]: unknown;
}

function resolveRelationshipId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relationId = (value as RelationshipValue).id;
    return typeof relationId === 'number' ? relationId : null;
  }

  return null;
}

function resolveWorkspaceId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'workspace' in value) {
    return resolveRelationshipId((value as RelationshipValue).workspace);
  }

  return resolveRelationshipId(value);
}

export const syncWorkspaceFromRelation = (
  relationField: string,
  relationCollection: SupportedRelationCollection
): CollectionBeforeChangeHook => {
  return async ({ data, originalDoc, req }) => {
    const relationId =
      resolveRelationshipId((data as Record<string, unknown> | undefined)?.[relationField]) ??
      resolveRelationshipId((originalDoc as Record<string, unknown> | undefined)?.[relationField]);

    if (!relationId) {
      return data;
    }

    const relatedDoc = await req.payload.findByID({
      collection: relationCollection as never,
      id: relationId,
      depth: 0,
      overrideAccess: true,
      req,
    });

    const relationWorkspaceId = resolveWorkspaceId(relatedDoc);

    if (!relationWorkspaceId) {
      throw new AppError(
        `Unable to resolve workspace from ${relationField}`,
        ErrorCode.VALIDATION_ERROR,
        400
      );
    }

    const nextData: DataWithWorkspace = {
      ...(data && typeof data === 'object' ? data : {}),
      workspace: relationWorkspaceId,
    };

    return nextData;
  };
};
