export type IngestionStage =
  | 'queued'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexed'
  | 'failed';

export type ParseStatus = 'pending' | 'parsing' | 'parsed' | 'failed';

export type IngestionStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface ChunkResult {
  content: string;
  contentHash: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface IngestJobPayload {
  fileId: number;
  workspaceId: number;
}
