import type { CollectionBeforeDeleteHook } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

const DEPENDENT_COLLECTIONS = [
  'agents',
  'whatsapp_sessions',
  'knowledge_files',
  'conversations',
  'messages',
  'message_traces',
  'knowledge_chunks',
  'ingestion_jobs',
] as const;

interface PayloadDatabaseExecutor {
  drizzle: unknown;
  execute: (args: { drizzle: unknown; raw: string }) => Promise<{ rows: Array<{ count?: string }> }>;
}

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

  const database = req.payload.db as unknown as PayloadDatabaseExecutor;
  const vectorCountResult = await database.execute({
    drizzle: database.drizzle,
    raw: `SELECT COUNT(*) AS count FROM knowledge_vectors WHERE workspace_id = ${workspaceId};`,
  });

  const vectorCount = Number(vectorCountResult.rows[0]?.count ?? 0);

  if (dependencyCounts.some((count) => count.totalDocs > 0) || vectorCount > 0) {
    throw new AppError(
      'Cannot delete workspace: dependent records exist. Remove all related agents, sessions, files, conversations, messages, traces, chunks, ingestion jobs, and vector rows first.',
      ErrorCode.WORKSPACE_HAS_DEPENDENCIES,
      409
    );
  }
};
