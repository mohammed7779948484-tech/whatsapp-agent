import type { CollectionBeforeDeleteHook } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

const DEPENDENT_COLLECTIONS = [
  'agents',
  'whatsapp_sessions',
  'knowledge_files',
  'conversations',
] as const;

export const workspaceBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const workspaceId = Number(id);

  if (!Number.isFinite(workspaceId)) {
    return;
  }

  const dependencyCounts = await Promise.all(
    DEPENDENT_COLLECTIONS.map((collection) =>
      req.payload.count({
        collection: collection as never,
        where: {
          workspace: {
            equals: workspaceId,
          },
        },
        overrideAccess: true,
        req,
      })
    )
  );

  if (dependencyCounts.some((count) => count.totalDocs > 0)) {
    throw new AppError(
      'Cannot delete workspace: dependent records exist. Remove all agents, sessions, files, and conversations first.',
      ErrorCode.WORKSPACE_HAS_DEPENDENCIES,
      409
    );
  }
};
