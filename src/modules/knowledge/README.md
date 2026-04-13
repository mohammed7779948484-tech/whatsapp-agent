# Knowledge Module

## Purpose
Pure domain logic for the knowledge ingestion pipeline - file parsing orchestration, text
chunking, embedding generation, and ingestion status management.

## Consumers
| Feature/Layer | Usage |
|---|---|
| `features/knowledge-uploads` | Upload, list, retry, delete, and summarize workspace knowledge files |
| `app/api/jobs/ingest-*` | Execute parse, chunk, and embed pipeline stages |

## Public API
| Export | Type | Description |
|---|---|---|
| `KnowledgeService` | Class | Orchestrates workspace-scoped ingestion workflows |
| `chunkText` | Function | Splits parsed content into heading-aware chunks |
| `IngestionStage` | Type | Job stage union for ingestion status tracking |
| `ParseStatus` | Type | File parse lifecycle union |
| `IngestionStatus` | Type | File indexing lifecycle union |
| `ChunkResult` | Type | Chunk payload emitted by the chunker |
| `IngestJobPayload` | Type | QStash job body for ingestion stages |
| `MAX_FILES_PER_WORKSPACE` | Constant | Workspace knowledge file cap |
| `CHUNK_SIZE_TOKENS` | Constant | Target chunk size |
| `CHUNK_OVERLAP_TOKENS` | Constant | Token overlap between chunks |
| `EMBEDDING_MODEL` | Constant | OpenAI embedding model identifier |
| `EMBEDDING_DIMENSIONS` | Constant | Expected embedding vector size |
| `EMBEDDING_BATCH_SIZE` | Constant | Maximum chunk texts per embedding request |

## Dependencies
- `core/env` - runtime service configuration
- `core/errors` - typed application errors
- `core/logger` - service diagnostics
- `core/providers` - QStash, LlamaParse, and OpenAI clients
- `payload/lib` - Payload Local API access

## Notes
- User-facing Payload reads and writes use `overrideAccess: false` with the owner user.
- Internal job-stage persistence uses trusted server-side writes scoped to an already resolved file.
- Chunking is pure and has no external side effects.
