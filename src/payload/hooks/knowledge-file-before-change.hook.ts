import type { CollectionBeforeChangeHook } from 'payload';

type KnowledgeFileData = Record<string, unknown>;

export const knowledgeFileBeforeChange: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== 'create') {
    return data;
  }

  const nextData: KnowledgeFileData = {
    ...(data && typeof data === 'object' ? data : {}),
  };

  if (!nextData.uploaded_at) {
    nextData.uploaded_at = new Date();
  }

  nextData.parse_status = 'pending';
  nextData.ingestion_status = 'pending';

  return nextData;
};
