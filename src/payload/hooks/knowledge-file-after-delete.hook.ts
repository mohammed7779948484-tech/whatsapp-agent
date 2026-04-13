import type { CollectionAfterDeleteHook, Payload } from 'payload';

import { logger } from '../../core/logger/index.ts';

interface PayloadDatabaseExecutor {
  drizzle: unknown;
  execute: (args: { drizzle: unknown; raw: string }) => Promise<unknown>;
}

interface KnowledgeFileDocument {
  id: number | string;
}

async function deleteKnowledgeVectors(payload: Payload, fileId: number): Promise<void> {
  const database = payload.db as unknown as PayloadDatabaseExecutor;

  // Safe: fileId is cast to Number and validated with Number.isFinite before this call,
  // so it is guaranteed to be a finite integer and cannot contain SQL injection payloads.
  await database.execute({
    drizzle: database.drizzle,
    raw: `DELETE FROM knowledge_vectors WHERE file_id = ${fileId};`,
  });
}

export const knowledgeFileAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const fileId = Number((doc as KnowledgeFileDocument | undefined)?.id);

  if (!Number.isFinite(fileId)) {
    return doc;
  }

  await req.payload.delete({
    collection: 'knowledge_chunks' as never,
    where: {
      file: {
        equals: fileId,
      },
    },
    overrideAccess: true,
    depth: 0,
    req,
  });

  await deleteKnowledgeVectors(req.payload, fileId);

  logger.info('Deleted knowledge file dependencies', {
    fileId,
  });

  return doc;
};
