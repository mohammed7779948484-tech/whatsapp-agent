export { KnowledgeService } from './services/knowledge.service';
export { chunkText } from './lib/chunker';
export {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_SIZE_TOKENS,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  MAX_FILES_PER_WORKSPACE,
} from './constants';
export type {
  ChunkResult,
  IngestJobPayload,
  IngestionStage,
  IngestionStatus,
  ParseStatus,
} from './types';
