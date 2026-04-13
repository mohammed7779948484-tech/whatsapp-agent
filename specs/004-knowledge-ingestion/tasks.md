# Tasks: Knowledge Ingestion Pipeline

**Input**: Design documents from `specs/004-knowledge-ingestion/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, contracts/job-routes.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create provider factories, add error codes, update env docs, and add the `parsed_content` field to `knowledge_files`. These are blocking prerequisites for all subsequent work.

- [x] T001 Install npm dependencies by running `pnpm add @upstash/qstash @llamaindex/llama-cloud openai gpt-tokenizer`. After installation, verify `package.json` contains all four packages in `dependencies`. Run `pnpm typecheck` to confirm no type resolution errors.

- [x] T002 [P] Add ingestion-specific error codes to `src/core/errors/error-codes.ts`. Add the following new keys to the `ErrorCode` object: `INGESTION_FAILED`, `FILE_LIMIT_EXCEEDED`, `PARSE_FAILED`, `QSTASH_NOT_CONFIGURED`. Do not remove or modify any existing error codes. After editing, run `pnpm typecheck` to verify the `ErrorCode` union type still compiles.

- [x] T003 [P] Create QStash provider factory at `src/core/providers/qstash-client.ts`. This file must export a function `createQstashClient()` that returns a `Client` instance from `@upstash/qstash`, configured with `env.QSTASH_TOKEN`. The function must check that `env.QSTASH_TOKEN` is a non-empty string at invocation time and throw an `AppError` with code `QSTASH_NOT_CONFIGURED` if missing. Follow the same factory pattern used by `src/core/providers/waha-client.ts`. Import `env` from `@/core/env`. Import `AppError` and `ErrorCode` from `@/core/errors`. Do not make `QSTASH_TOKEN` a required boot-time variable; it is validated only when the factory is called.

- [x] T004 [P] Create LlamaParse provider factory at `src/core/providers/llama-parse-client.ts`. This file must export a function `createLlamaParseClient()` that returns a `LlamaCloud` instance from `@llamaindex/llama-cloud`, configured with `apiKey: env.LLAMA_PARSE_API_KEY`. The function must check that `env.LLAMA_PARSE_API_KEY` is a non-empty string at invocation time and throw an `AppError` with code `EXTERNAL_SERVICE_ERROR` and message `'LlamaParse API key is not configured'` if missing. Follow the same factory pattern as `src/core/providers/waha-client.ts`.

- [x] T005 [P] Create OpenAI provider factory at `src/core/providers/openai-client.ts`. This file must export a function `createOpenAIClient()` that returns an `OpenAI` instance from the `openai` package, configured with `apiKey: env.OPENAI_API_KEY`. The function must check that `env.OPENAI_API_KEY` is a non-empty string at invocation time and throw an `AppError` with code `EXTERNAL_SERVICE_ERROR` and message `'OpenAI API key is not configured'` if missing. Follow the same factory pattern as `src/core/providers/waha-client.ts`.

- [x] T006 Add `parsed_content` textarea field to the `knowledge_files` collection in `src/payload/collections/knowledge-files.collection.ts`. Add the field after the existing `indexed_at` field. The field definition must be: `{ name: 'parsed_content', type: 'textarea' }` (not required, no default). This field stores the LlamaParse markdown/text output. **Before implementing this task, read the local Payload skill at `.agents/skills/payload/SKILL.md` and the field reference at `.agents/skills/payload/reference/FIELDS.md`. Do not guess Payload behavior from memory; use the repository Payload skill/reference as the source of truth.** After editing, run `pnpm typecheck` to verify. If regenerating Payload types is required, run `pnpm payload generate:types`.

- [x] T007 Update `.env.example` to promote ingestion-related environment variables. Change the existing commented-out lines for `OPENAI_API_KEY`, `LLAMA_PARSE_API_KEY`, `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` from the "Optional integrations" comment group to a new clearly labeled section `# Knowledge Ingestion Pipeline (required for file processing)`. Keep them commented out (prefixed with `#`) but add clear descriptions of what each variable does, matching the format of the existing WAHA section. Do not remove any existing `.env.example` content.

**Checkpoint**: All providers compile, error codes exist, `knowledge_files` has `parsed_content`, `.env.example` is updated. Run `pnpm typecheck` to verify.

---

## Phase 2: Foundational (Knowledge Module + Chunker)

**Purpose**: Create the `knowledge` module with its business logic service and the heading-aware text chunker. These are the domain primitives needed by both job routes and Server Actions.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 Create the `knowledge` module directory scaffold. Create these files: `src/modules/knowledge/README.md`, `src/modules/knowledge/constants.ts`, `src/modules/knowledge/types.ts`, `src/modules/knowledge/index.ts`. Follow the approved module template at `.specify/memory/standards/module-template.md`. In `constants.ts`, export these constants: `MAX_FILES_PER_WORKSPACE = 20`, `CHUNK_SIZE_TOKENS = 600`, `CHUNK_OVERLAP_TOKENS = 80`, `EMBEDDING_MODEL = 'text-embedding-3-small' as const`, `EMBEDDING_DIMENSIONS = 1536`, `EMBEDDING_BATCH_SIZE = 100`. In `types.ts`, export: `IngestionStage` (union of `'queued' | 'parsing' | 'chunking' | 'embedding' | 'indexed' | 'failed'`), `ParseStatus` (union of `'pending' | 'parsing' | 'parsed' | 'failed'`), `IngestionStatus` (union of `'pending' | 'processing' | 'indexed' | 'failed'`), `ChunkResult` (object with `content: string`, `contentHash: string`, `chunkIndex: number`, `metadata: Record<string, unknown>`), and `IngestJobPayload` (object with `fileId: number`, `workspaceId: number`). In `README.md`, document the module's purpose: "Pure domain logic for the knowledge ingestion pipeline — file parsing orchestration, text chunking, embedding generation, and ingestion status management." In `index.ts`, re-export all public types and constants from `types.ts` and `constants.ts`.

- [x] T009 Create the heading-aware text chunker at `src/modules/knowledge/lib/chunker.ts`. This file must export a function `chunkText(text: string): ChunkResult[]` that splits input text into chunks. Import `ChunkResult` from `../types`. Import `CHUNK_SIZE_TOKENS` and `CHUNK_OVERLAP_TOKENS` from `../constants`. The chunking algorithm must:
  1. Use `gpt-tokenizer` (import `encode` from `gpt-tokenizer`) to count tokens accurately.
  2. Split the input on `\n\n` (paragraph boundaries) first.
  3. Detect heading lines (lines starting with one or more `#` characters). Maintain a `currentHeading` variable that tracks the most recent heading seen. Prepend `currentHeading + '\n\n'` to each chunk that doesn't start with a heading.
  4. Detect table blocks (consecutive lines starting with `|`). Never split a table block across chunks. If a table block exceeds `CHUNK_SIZE_TOKENS`, keep it as a single oversized chunk rather than splitting a row.
  5. Accumulate paragraphs into a chunk until adding the next paragraph would exceed `CHUNK_SIZE_TOKENS`. When a chunk boundary is hit, emit the current chunk and start a new one overlapping by `CHUNK_OVERLAP_TOKENS` tokens from the end of the previous chunk.
  6. For each emitted chunk, compute `contentHash` as the hex SHA-256 of the `content` string (use `crypto.createHash('sha256')`).
  7. Set `chunkIndex` as a 0-based sequential integer.
  8. Set `metadata` to `{ heading: currentHeading || null }`.
  9. Filter out empty chunks (content is empty or only whitespace after trimming).
  10. Return the array of `ChunkResult` objects.
  This function must be a pure function with no side effects and no external service calls.

- [x] T010 Create the `KnowledgeService` class at `src/modules/knowledge/services/knowledge.service.ts`. This is the core business logic orchestrator for the ingestion pipeline. It must import and use: `getPayloadClient` from `@/payload/lib`, `createQstashClient` from `@/core/providers/qstash-client`, `createLlamaParseClient` from `@/core/providers/llama-parse-client`, `createOpenAIClient` from `@/core/providers/openai-client`, `createLogger` from `@/core/logger`, `env` from `@/core/env`, `AppError` and `ErrorCode` from `@/core/errors`, `chunkText` from `../lib/chunker`, and constants/types from the module. **Before implementing, read `.agents/skills/payload/SKILL.md` and `.agents/skills/payload/reference/COLLECTIONS.md` and `.agents/skills/payload/reference/HOOKS.md` for Payload Local API patterns.** The service must implement these methods (detailed in sub-tasks T011–T016B). Use `private readonly logger = createLogger('modules/knowledge/service')` for logging. All Payload Local API calls that are user-facing must use `overrideAccess: false` with the user context. System/internal calls in job routes use `overrideAccess: true`.

- [x] T011 Implement `KnowledgeService.getFilesForWorkspace(workspaceId: number, user: User): Promise<KnowledgeFile[]>` in `src/modules/knowledge/services/knowledge.service.ts`. This method queries `knowledge_files` for the given workspace using Payload's `find()` with `overrideAccess: false`, `user`, `where: { workspace: { equals: workspaceId } }`, `sort: '-uploaded_at'`, and `depth: 0`. Return `result.docs`. Used by the Knowledge Uploads page to list files.

- [x] T012 Implement `KnowledgeService.getWorkspaceKnowledgeSummary(workspaceId: number, user: User): Promise<{ indexedCount: number; lastUpdatedAt: string | null }>` in `src/modules/knowledge/services/knowledge.service.ts`. This method:
  1. Queries `knowledge_files` with `overrideAccess: false`, `user`, `where: { workspace: { equals: workspaceId }, ingestion_status: { equals: 'indexed' } }`, `limit: 0` (to get `totalDocs` only).
  2. Queries `workspaces` via `findByID` with `overrideAccess: false`, `user`, `id: workspaceId`, `depth: 0`.
  3. Returns `{ indexedCount: result.totalDocs, lastUpdatedAt: workspace.last_knowledge_update_at ?? null }`.
  Used by the dashboard summary card.

- [x] T013 Implement `KnowledgeService.parseFile(fileId: number, workspaceId: number): Promise<void>` in `src/modules/knowledge/services/knowledge.service.ts`. This method is called by the `ingest-parse` job route. It must:
  1. Get the Payload client via `getPayloadClient()`.
  2. Load the `knowledge_files` record using `findByID` with `overrideAccess: true`, `id: fileId`, `depth: 0`. If not found, log a warning and return (file was deleted; graceful no-op).
  3. Find the `ingestion_jobs` record for this file: `find` with `overrideAccess: true`, `where: { file: { equals: fileId } }`, `limit: 1`.
  4. Update the ingestion job: `stage: 'parsing'`, `started_at: new Date().toISOString()`.
  5. Update the file: `parse_status: 'parsing'`, `ingestion_status: 'processing'`.
  6. Download the file from its URL (`file.url`). Use `fetch(fileUrl)` to get the response, then `response.arrayBuffer()` to get the bytes. Build the full URL by prepending `env.APP_URL` if the url field is a relative path.
  7. Create the LlamaParse client. Upload the file buffer to LlamaParse using the SDK's `files.create()` method, then parse using `parsing.parse()` requesting markdown output.
  8. If LlamaParse returns empty/null content, treat it as a parse failure: update file `parse_status: 'failed'`, `ingestion_status: 'failed'`, `ingestion_error: 'LlamaParse returned empty content'`; update job `stage: 'failed'`, `last_error: 'LlamaParse returned empty content'`; and return. This is a terminal (non-transient) failure — the service must NOT throw, so the route returns `200` and QStash does not retry a condition that will not self-heal.
  9. On successful parse: update file `parsed_content` with the markdown output, `parse_status: 'parsed'`, `parsed_at: new Date().toISOString()`. Update job `stage: 'chunking'`.
  10. Enqueue the next stage: `createQstashClient().publishJSON({ url: \`${env.APP_URL}/api/jobs/ingest-chunk\`, body: { fileId, workspaceId } })`.
  11. Wrap the entire method in a try/catch. On unexpected errors: update file `parse_status: 'failed'`, `ingestion_status: 'failed'`, `ingestion_error: error.message`; update job `stage: 'failed'`, `last_error: error.message`; re-throw so the route can decide the HTTP status.

- [x] T014 Implement `KnowledgeService.chunkFile(fileId: number, workspaceId: number): Promise<void>` in `src/modules/knowledge/services/knowledge.service.ts`. This method is called by the `ingest-chunk` job route. It must:
  1. Get the Payload client.
  2. Load the `knowledge_files` record with `overrideAccess: true`. If not found, log and return (graceful no-op for deleted files).
  3. Read `parsed_content` from the file record. If empty/null, log an error, update job and file to `failed` with error `'No parsed content available for chunking'`, and return. This is a terminal (non-transient) failure — the service must NOT throw, so the route returns `200` and QStash does not retry a condition that will not self-heal.
  4. **Idempotency**: Delete ALL existing `knowledge_chunks` for this file: `payload.delete({ collection: 'knowledge_chunks', where: { file: { equals: fileId } }, overrideAccess: true })`. **Before implementing Payload delete-by-where, read `.agents/skills/payload/reference/COLLECTIONS.md` for the correct Local API delete syntax with `where` clause.**
  5. Update ingestion job: `stage: 'chunking'`.
  6. Call `chunkText(file.parsed_content)` to split the text.
  7. If zero chunks are produced, update job and file to `failed` with error `'Chunking produced zero results'`, and return. This is a terminal (non-transient) failure — the service must NOT throw, so the route returns `200` and QStash does not retry a condition that will not self-heal.
  8. Bulk-create `knowledge_chunks` records: iterate over the chunk results and call `payload.create({ collection: 'knowledge_chunks', data: { workspace: workspaceId, file: fileId, chunk_index: chunk.chunkIndex, content: chunk.content, content_hash: chunk.contentHash, metadata_json: chunk.metadata }, overrideAccess: true, depth: 0 })` for each chunk. Use `as never` for the `collection` string if TypeScript complains (matching existing pattern in `knowledge-chunks.collection.ts`).
  9. Update ingestion job: `stage: 'embedding'`.
  10. Enqueue next stage: `createQstashClient().publishJSON({ url: \`${env.APP_URL}/api/jobs/ingest-embed\`, body: { fileId, workspaceId } })`.
  11. Wrap in try/catch. On errors: update job and file to `failed`, re-throw.

- [x] T015 Implement `KnowledgeService.embedFile(fileId: number, workspaceId: number): Promise<void>` in `src/modules/knowledge/services/knowledge.service.ts`. This method is called by the `ingest-embed` job route. It must:
  1. Get the Payload client.
  2. Load the `knowledge_files` record with `overrideAccess: true`. If not found, log and return (graceful no-op).
  3. Load all `knowledge_chunks` for this file: `find` with `overrideAccess: true`, `where: { file: { equals: fileId } }`, `limit: 1000`, `sort: 'chunk_index'`. If zero chunks are found, update job and file to `failed` with error `'No chunks found for embedding'`, and return. This is a terminal (non-transient) failure — the service must NOT throw, so the route returns `200` and QStash does not retry a condition that will not self-heal.
  4. **Idempotency**: Delete ALL existing vectors for this file via raw SQL: access `payload.db` and execute `DELETE FROM knowledge_vectors WHERE file_id = ${fileId}`. Use the same `PayloadDatabaseExecutor` pattern from `src/payload/hooks/knowledge-file-after-delete.hook.ts`.
  5. Update ingestion job: `stage: 'embedding'`.
  6. Collect chunk contents into an array of strings. If the array length exceeds `EMBEDDING_BATCH_SIZE` (100), split into batches. For each batch, call `createOpenAIClient().embeddings.create({ model: EMBEDDING_MODEL, input: batchTexts })`.
  7. For each chunk + embedding pair, insert a `knowledge_vectors` row via raw SQL: `INSERT INTO knowledge_vectors (workspace_id, file_id, chunk_id, embedding, created_at) VALUES (${workspaceId}, ${fileId}, ${chunkId}, '[${embedding.join(',')}]', NOW())`. Use parameterized values where possible. Use the same `PayloadDatabaseExecutor` pattern.
  8. On full success: update file `ingestion_status: 'indexed'`, `indexed_at: new Date().toISOString()`. Update job `stage: 'indexed'`, `finished_at: new Date().toISOString()`. Update workspace `last_knowledge_update_at: new Date().toISOString()` via `payload.update({ collection: 'workspaces', id: workspaceId, data: { last_knowledge_update_at: new Date().toISOString() }, overrideAccess: true })`.
  9. On failure: clean up any partial vectors for this file via `DELETE FROM knowledge_vectors WHERE file_id = ${fileId}`. Update job and file to `failed`. Re-throw.

- [x] T016 Implement `KnowledgeService.retryIngestion(fileId: number, workspaceId: number, user: User): Promise<{ jobId: number }>` in `src/modules/knowledge/services/knowledge.service.ts`. This method is called by the retry Server Action. It must:
  1. Get the Payload client.
  2. Load the `knowledge_files` record with `overrideAccess: false` and `user`. Throw `AppError` with `NOT_FOUND_ERROR` if not found.
  3. Verify `file.ingestion_status === 'failed'`. If not, throw `AppError` with `VALIDATION_ERROR` and message `'Only failed ingestions can be retried'`.
  4. Find the `ingestion_jobs` record for this file. Throw if not found.
  5. Determine the restart stage. The ingestion job's current `stage` is `'failed'`. To determine what stage failed, inspect the file's `parse_status`:
     - If `parse_status === 'failed'` → restart from `'parsing'`. No cleanup needed.
     - If `parse_status === 'parsed'` → the failure was in chunking or embedding. Clean up existing chunks and vectors for the file (delete chunks via Payload, delete vectors via raw SQL), then restart from `'chunking'`.
  6. Increment `attempt_count` by 1.
  7. Update the ingestion job: `stage` to the restart stage, `last_error: null`, `started_at: null`, `finished_at: null`.
  8. Update the file: `ingestion_status: 'processing'`, `ingestion_error: null`. If restarting from parsing, also set `parse_status: 'pending'`, `parsed_content: null`, `parsed_at: null`.
  9. Enqueue the correct QStash job based on restart stage:
     - `'parsing'` → `/api/jobs/ingest-parse`
     - `'chunking'` → `/api/jobs/ingest-chunk`
  10. Return `{ jobId: ingestionJob.id }`.

- [x] T016A Implement `KnowledgeService.uploadFile(params: { workspaceId: number; user: User; file: File }): Promise<{ fileId: number }>` in `src/modules/knowledge/services/knowledge.service.ts`. This method is called by the upload Server Action (T019). **Before implementing, read `.agents/skills/payload/SKILL.md` and `.agents/skills/payload/reference/COLLECTIONS.md` for upload-enabled collection file creation via the Local API. Do not guess Payload upload behavior.** It must:
  1. Get the Payload client.
  2. Count existing files: `payload.find({ collection: 'knowledge_files', where: { workspace: { equals: workspaceId } }, limit: 0, overrideAccess: false, user })`. If `result.totalDocs >= MAX_FILES_PER_WORKSPACE`, throw `AppError` with `FILE_LIMIT_EXCEEDED` and message `'You have reached the maximum of 20 files. Delete an existing file to upload a new one.'`.
  3. Create the `knowledge_files` record via Payload upload with `overrideAccess: false` and `user` for owner-scoped creation. Pass `file: { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type, name: file.name, size: file.size }`.
  4. Create the `ingestion_jobs` record with `overrideAccess: true` (internal system collection owners do not have direct CRUD access to).
  5. Enqueue `ingest-parse` via QStash with `{ fileId: createdFile.id, workspaceId }`.
  6. Return `{ fileId: createdFile.id }`.

- [x] T016B Implement `KnowledgeService.deleteFile(fileId: number, workspaceId: number, user: User): Promise<void>` in `src/modules/knowledge/services/knowledge.service.ts`. This method is called by the delete Server Action (T033). **Before implementing, read `.agents/skills/payload/SKILL.md` and `.agents/skills/payload/reference/COLLECTIONS.md` for delete-by-ID syntax with user-scoped access. Do not guess Payload delete behavior.** It must:
  1. Get the Payload client.
  2. Delete the `knowledge_files` record: `payload.delete({ collection: 'knowledge_files', id: fileId, user, overrideAccess: false })`. The existing `knowledgeFileAfterDelete` hook handles cascading cleanup of chunks, vectors, and R2 objects.

- [x] T017 Update the barrel export at `src/modules/knowledge/index.ts` to re-export `KnowledgeService` from `./services/knowledge.service`. Also re-export all public types and constants. The public API of the module is: `KnowledgeService` (class), all types from `types.ts`, all constants from `constants.ts`, and `chunkText` from `lib/chunker.ts`.

**Checkpoint**: The `knowledge` module compiles and exports its full public API. `chunkText` is a pure function. `KnowledgeService` methods are defined and use the correct provider factories. Run `pnpm typecheck`.

---

## Phase 3: User Story 1 — Owner Uploads a Knowledge File (Priority: P1) 🎯 MVP

**Goal**: An owner can upload a PDF or CSV file through the dashboard, and the system stores it, creates an ingestion job, and enqueues the first pipeline stage.

**Independent Test**: Upload a valid PDF and a valid CSV. Both appear in the file list. An ingestion job is created. QStash receives an `ingest-parse` message.

### Implementation for User Story 1

- [x] T018 [US1] Create the `knowledge-uploads` feature scaffold. Create the following files following the approved feature template at `.specify/memory/standards/feature-template.md`:
  - `src/features/knowledge-uploads/README.md` — document the feature purpose: "Owner-facing knowledge file upload, listing, retry, and deletion UI with associated Server Actions."
  - `src/features/knowledge-uploads/constants.ts` — export `KNOWLEDGE_UPLOADS_FEATURE_ID = 'knowledge-uploads' as const` and `KNOWLEDGE_PAGE_PATH = '/knowledge' as const`.
  - `src/features/knowledge-uploads/types.ts` — export `KnowledgeFileDisplayStatus` (union: `'uploaded' | 'parsing' | 'indexing' | 'indexed' | 'failed'`) and a helper function `mapFileToDisplayStatus(parseStatus: string, ingestionStatus: string): KnowledgeFileDisplayStatus`. This helper maps stored DB states to UI labels: `ingestion_status === 'indexed'` → `'indexed'`; `ingestion_status === 'failed' || parse_status === 'failed'` → `'failed'`; `parse_status === 'parsing'` → `'parsing'`; `ingestion_status === 'processing'` → `'indexing'`; default initial DB state (`pending` / `pending`) → `'uploaded'`.
  - `src/features/knowledge-uploads/feature.config.ts` — export a `FeatureConfig` object with `id: KNOWLEDGE_UPLOADS_FEATURE_ID`, `name: 'Knowledge Uploads'`, `description: 'Owner-facing knowledge file upload, listing, retry, deletion, and freshness surfaces.'`, `dependencies: ['modules/knowledge']`, `enabled: true`.
  - `src/features/knowledge-uploads/index.ts` — re-export `knowledgeUploadsConfig` from `feature.config.ts`, types from `types.ts`, and constants from `constants.ts`. Note: `KnowledgeUploadsPage` is added to this barrel when created in T020; `KnowledgeDashboardSummary` is added in T037.

- [x] T019 [US1] Create the upload Server Action at `src/features/knowledge-uploads/actions/upload-knowledge-file.action.ts`. This file must use `'use server'` directive at the top. Follow the contract in `specs/004-knowledge-ingestion/contracts/server-actions.md` exactly. The action receives `FormData` and must:
  1. Call `getOwnerDashboardSession()` to get `user` and `workspaceId`.
  2. Extract the file from `formData.get('file')`. Validate it is a `File` instance.
  3. Validate MIME type is `'application/pdf'` or `'text/csv'`. Return `ActionResult` error with message `'Only PDF and CSV files are accepted'` if not.
  4. Validate file size: `file.size <= env.MAX_UPLOAD_MB * 1024 * 1024`. Return error `'File exceeds the maximum size of ${env.MAX_UPLOAD_MB} MB'` if too large.
  5. Validate `env.QSTASH_TOKEN` is non-empty. Return error `'File processing is not available. Contact support.'` if missing.
  6. Instantiate `KnowledgeService` and delegate the full upload orchestration to `knowledgeService.uploadFile({ workspaceId, user, file })`. **Do not perform Payload `find/create` logic inline in this action.** The module service owns the workspace-scoped file-count check, upload-enabled `knowledge_files` creation, `ingestion_jobs` creation, and QStash enqueue. This keeps the action aligned with the approved feature template: validate session/input in the action, then delegate business logic to the module.
  7. Call `revalidatePath('/knowledge')`.
  8. Return `{ success: true, data: { fileId } }` from the service result.
  9. Wrap the flow in try/catch. On errors, return `{ success: false, error: 'Upload failed. Please try again.' }`.

- [x] T020 [US1] Create the Knowledge Uploads page component at `src/features/knowledge-uploads/ui/KnowledgeUploadsPage.tsx`. This is an async server component that:
  1. Calls `getOwnerDashboardSession()` to get `user` and `workspaceId`.
  2. Instantiates `KnowledgeService` and calls `getFilesForWorkspace(workspaceId, user)`.
  3. Calls `getWorkspaceKnowledgeSummary(workspaceId, user)` for the freshness timestamp.
  4. Renders a page layout containing:
     - An `<h1>` with text "Knowledge Base"
     - The `last_knowledge_update_at` timestamp (or "No knowledge uploaded yet" if null)
     - A `KnowledgeUploadForm` component (client component, see T021)
     - A `KnowledgeFileList` component with the files array mapped through `mapFileToDisplayStatus`
     - An empty state when no files exist: text "No files uploaded yet" and a prompt to upload
  Also update the barrel export at `src/features/knowledge-uploads/index.ts` to add `KnowledgeUploadsPage`.

- [x] T021 [US1] Create the upload form client component at `src/features/knowledge-uploads/ui/_components/KnowledgeUploadForm.tsx`. This is a `'use client'` component. It must:
  1. Render a `<form>` with a file input accepting `.pdf,.csv` and a submit button.
  2. On submit, construct a `FormData` with the selected file, call the `uploadKnowledgeFile` Server Action, and display success or error feedback.
  3. Show a loading state while the upload is in progress (disable the button, show a spinner or "Uploading…" text).
  4. On success, clear the file input. The page revalidation from the Server Action will refresh the file list.

- [x] T022 [US1] Create the file list component at `src/features/knowledge-uploads/ui/_components/KnowledgeFileList.tsx`. This is a server component that receives a `files` prop (array of file objects with display status). It renders a list/table with columns: filename, upload date (formatted), status badge, and an actions column (placeholder for retry/delete, implemented in later stories).

- [x] T023 [US1] Create the file row component at `src/features/knowledge-uploads/ui/_components/KnowledgeFileRow.tsx`. This receives a single file object and renders: the filename, the formatted `uploaded_at` date, a status badge (colored by status: `indexed` = green, `failed` = red, `parsing`/`indexing` = yellow/blue, `uploaded` = gray), and an actions slot (empty for now, filled in US4/US5).

- [x] T024 [US1] Create the Knowledge Uploads page route at `src/app/(frontend)/(dashboard)/knowledge/page.tsx`. This file must import and render `KnowledgeUploadsPage` from `@/features/knowledge-uploads`. Add appropriate `metadata` export with `title: 'Knowledge Base'`.

- [x] T025 [US1] Register the `knowledge-uploads` feature in `src/features/_registry/index.ts`. Import `knowledgeUploadsConfig` from `@/features/knowledge-uploads` and add it to the `featureRegistry` Map, matching the pattern used by `authLoginConfig` and `whatsappConnectionConfig`.

**Checkpoint**: Owner can upload a PDF or CSV. The file appears in the Knowledge Uploads page list. An `ingestion_jobs` record is created. QStash receives an `ingest-parse` message. Invalid files and file-limit violations are rejected with clear errors. Run `pnpm typecheck`.

---

## Phase 4: User Story 2 — Async Parse-Chunk-Embed Pipeline (Priority: P1)

**Goal**: The three QStash job routes are real implementations that process files through parse → chunk → embed and update all statuses correctly.

**Independent Test**: Manually enqueue an `ingest-parse` job for a valid uploaded file. Verify the file progresses through all three stages and results in `knowledge_chunks` rows and `knowledge_vectors` rows.

### Implementation for User Story 2

- [x] T026 [US2] Replace the `ingest-parse` scaffold at `src/app/api/jobs/ingest-parse/route.ts`. Remove the existing `createNotImplementedResponse` import and handler. Implement the handler per `specs/004-knowledge-ingestion/contracts/job-routes.md`. The file must:
  1. Import `verifySignatureAppRouter` from `@upstash/qstash/nextjs`.
  2. Define an `async function handler(request: Request)` that:
     a. Parses the JSON body. Validates `fileId` and `workspaceId` are present and numeric. If not, return `NextResponse.json({ error: 'Invalid payload' }, { status: 400 })`.
     b. Instantiates `KnowledgeService` and calls `parseFile(fileId, workspaceId)`.
     c. Returns `NextResponse.json({ success: true }, { status: 200 })`.
     d. Catches errors: logs the error. If the service returned normally (no throw), the route has already returned `200` in step c — this covers successful processing, safe no-ops (deleted file), and terminal business failures (empty content, zero chunks). If the service throws, the error is transient/infrastructure: return `NextResponse.json({ error: 'Internal error' }, { status: 500 })` so QStash retries.
  3. Export `POST = verifySignatureAppRouter(handler)`.
  This route must NOT handle any logic itself; all business logic is in `KnowledgeService.parseFile()`.

- [x] T027 [US2] Replace the `ingest-chunk` scaffold at `src/app/api/jobs/ingest-chunk/route.ts`. Follow the exact same error-handling pattern as T026 but call `KnowledgeService.chunkFile(fileId, workspaceId)`. Use `verifySignatureAppRouter` as the outermost wrapper. Service returns normally on success, no-ops, and terminal failures (route returns `200`). Service throws on transient errors only (route returns `500` for QStash retry).

- [x] T028 [US2] Replace the `ingest-embed` scaffold at `src/app/api/jobs/ingest-embed/route.ts`. Follow the exact same error-handling pattern as T026 but call `KnowledgeService.embedFile(fileId, workspaceId)`. Use `verifySignatureAppRouter` as the outermost wrapper. Service returns normally on success, no-ops, and terminal failures (route returns `200`). Service throws on transient errors only (route returns `500` for QStash retry).

**Checkpoint**: All three job routes compile and are secured with QStash signature verification. Each delegates to the knowledge service. The full pipeline `parse → chunk → embed → indexed` is wired. Run `pnpm typecheck`.

---

## Phase 5: User Story 3 — Owner Views Knowledge File List and Status (Priority: P1)

**Goal**: The Knowledge Uploads page accurately displays all files with real-time status, formatted dates, and the workspace freshness timestamp.

**Independent Test**: Upload two files. One succeeds (indexed), one fails (failed). The Knowledge Uploads page shows both with correct status labels and the correct freshness timestamp.

### Implementation for User Story 3

- [ ] T029 [US3] Verify and polish `KnowledgeUploadsPage.tsx` to correctly display per-file status badges and the workspace `last_knowledge_update_at` timestamp. The page must:
  1. Map each file from the service response through `mapFileToDisplayStatus(file.parse_status, file.ingestion_status)` to get the display status.
  2. Pass the mapped status to `KnowledgeFileRow`.
  3. Display `lastUpdatedAt` from the workspace summary. If null, show "No knowledge indexed yet". If present, format as a human-readable date string.
  4. If the files array is empty, show an empty state: "No files uploaded yet. Upload a PDF or CSV to get started."

- [ ] T030 [US3] Verify that the `KnowledgeFileRow` component renders the correct status badge colors:
  - `'indexed'` → green badge text "Indexed"
  - `'failed'` → red badge text "Failed"
  - `'parsing'` → yellow/amber badge text "Parsing…"
  - `'indexing'` → blue badge text "Indexing…"
  - `'uploaded'` → gray badge text "Uploaded"
  Ensure each badge has a unique `id` attribute for testing (e.g., `id={`status-badge-${file.id}`}`).

**Checkpoint**: Knowledge Uploads page renders with accurate per-file statuses and the workspace freshness timestamp. Run `pnpm typecheck`.

---

## Phase 6: User Story 4 — Owner Retries a Failed Ingestion (Priority: P2)

**Goal**: An owner can retry a failed ingestion from the Knowledge Uploads page. Retry cleans up partial artifacts and restarts from the correct stage.

**Independent Test**: Simulate a parse failure. Click retry. Confirm the pipeline restarts from parse stage with incremented attempt_count.

### Implementation for User Story 4

- [ ] T031 [US4] Create the retry Server Action at `src/features/knowledge-uploads/actions/retry-ingestion.action.ts`. This file must use `'use server'` directive. Follow the contract in `specs/004-knowledge-ingestion/contracts/server-actions.md`. The action receives `fileId: number` and must:
  1. Call `getOwnerDashboardSession()` to get `user` and `workspaceId`.
  2. Instantiate `KnowledgeService` and delegate retry logic to `knowledgeService.retryIngestion(fileId, workspaceId, user)`. **Do not perform Payload lookup logic inline in this action.** The module service owns the owner-scoped file/job lookup, eligibility check, cleanup, and re-enqueue flow.
  3. Call `revalidatePath('/knowledge')`.
  4. Return `{ success: true, data: { jobId } }`.
  5. Wrap in try/catch, return generic error on failure.

- [ ] T032 [US4] Add a "Retry" button to `KnowledgeFileRow.tsx`. The button must:
  1. Only be visible when the file's display status is `'failed'`.
  2. Be a client-interactive element. Create a small client component `RetryButton` (inline or in `_components/`) that calls the `retryIngestion` Server Action with the file ID on click.
  3. Show a loading state while the retry is in progress.
  4. On success, the page revalidation from the Server Action refreshes the file list.
  5. On error, display the error message.

**Checkpoint**: Owner can retry a failed ingestion. The pipeline restarts from the correct stage. Partial artifacts from the previous attempt are cleaned up. Run `pnpm typecheck`.

---

## Phase 7: User Story 5 — Owner Deletes a Knowledge File (Priority: P2)

**Goal**: An owner can delete a knowledge file. Deletion cascades to chunks, vectors, and the R2 object via the existing `knowledgeFileAfterDelete` hook.

**Independent Test**: Index a file fully. Delete it. Verify chunks, vectors, and R2 object are all removed.

### Implementation for User Story 5

- [ ] T033 [US5] Create the delete Server Action at `src/features/knowledge-uploads/actions/delete-knowledge-file.action.ts`. This file must use `'use server'` directive. Follow the contract in `specs/004-knowledge-ingestion/contracts/server-actions.md`. The action receives `fileId: number` and must:
  1. Call `getOwnerDashboardSession()` to get `user` and `workspaceId`.
  2. Instantiate `KnowledgeService` and delegate deletion to `knowledgeService.deleteFile(fileId, workspaceId, user)`. **Do not perform Payload delete logic inline in this action.** The module service owns the owner-scoped `knowledge_files` lookup and delete flow.
  3. Call `revalidatePath('/knowledge')`.
  4. Return `{ success: true }`.
  5. Wrap in try/catch, return generic error on failure.

- [ ] T034 [US5] Add a "Delete" button to `KnowledgeFileRow.tsx`. The button must:
  1. Be visible for all files regardless of status (owners can delete files in any state, including in-progress).
  2. Be a client-interactive element. Create a small client component `DeleteButton` (inline or in `_components/`) that calls the `deleteKnowledgeFile` Server Action with the file ID on click.
  3. Show a confirmation prompt before deletion (e.g., `window.confirm('Delete this file? This will remove all associated knowledge.')` or a simple confirmation UI).
  4. Show a loading state while the deletion is in progress.
  5. On success, the page revalidation refreshes the file list.

- [ ] T035 [US5] Verify graceful handling of file deletion during in-progress ingestion. Confirm that:
  1. If a file is deleted while its `ingest-parse` job is enqueued or running, the parse job's first step loads the file record. If the record is not found (deleted), the job logs a warning and returns `200` (no-op). This is already handled by the `parseFile` method in T013.
  2. If a file is deleted while its `ingest-chunk` or `ingest-embed` job is enqueued, the same graceful behavior applies (checked in T014 and T015).
  3. No additional code changes should be needed for this — this task is a verification task. Review the `parseFile`, `chunkFile`, and `embedFile` methods to confirm each starts by loading the file and returns early if not found. If any method does NOT do this, fix it now.

**Checkpoint**: Owner can delete files in any state. Chunks, vectors, and R2 objects are cleaned up. In-progress pipeline jobs for deleted files exit gracefully. Run `pnpm typecheck`.

---

## Phase 8: User Story 6 — Dashboard Shows Knowledge Freshness (Priority: P3)

**Goal**: The main dashboard page displays the workspace's last knowledge update timestamp and the count of indexed files.

**Independent Test**: Upload and fully index a file. Visit the dashboard. See the freshness timestamp and file count.

### Implementation for User Story 6

- [ ] T036 [US6] Create the presentational widget at `src/widgets/knowledge-freshness/KnowledgeFreshnessWidget.tsx`. This receives props: `indexedCount: number` and `lastUpdatedAt: string | null`. It renders a card with:
  - Title: "Knowledge Base"
  - If `lastUpdatedAt` is null: "No knowledge uploaded" with a suggestion to upload files
  - If `lastUpdatedAt` is present: formatted date + count text (e.g., "3 files indexed")
  - Follow the same presentational pattern as `src/widgets/whatsapp-status/WhatsAppStatusWidget.tsx`
  Create the barrel export at `src/widgets/knowledge-freshness/index.ts`.

- [ ] T037 [US6] Create the data loader component at `src/features/knowledge-uploads/ui/KnowledgeDashboardSummary.tsx`. This is an async server component that:
  1. Calls `getOwnerDashboardSession()` to get `user` and `workspaceId`.
  2. Instantiates `KnowledgeService` and calls `getWorkspaceKnowledgeSummary(workspaceId, user)`.
  3. Renders `KnowledgeFreshnessWidget` with the fetched data.
  Export this component from the feature barrel at `src/features/knowledge-uploads/index.ts`.

- [ ] T038 [US6] Update the dashboard page at `src/app/(frontend)/(dashboard)/dashboard/page.tsx`. Import `KnowledgeDashboardSummary` from `@/features/knowledge-uploads`. Add it below the existing `<WhatsAppDashboardSummary />` component. Do not modify or remove existing dashboard content.

**Checkpoint**: Dashboard page shows the knowledge freshness card alongside the WhatsApp status card. Run `pnpm typecheck`.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Tests, validation, env docs, and handover.

- [ ] T039 [P] Create unit tests for the chunker at `tests/unit/modules/knowledge/chunker.test.ts`. Test the following cases:
  1. Basic text splitting into chunks respecting the 600-token target
  2. Heading context preservation (chunks after a heading include the heading text)
  3. Table block preservation (lines starting with `|` are not split across chunks)
  4. Overlap behavior (last 80 tokens of previous chunk appear at start of next chunk)
  5. Empty input returns empty array
  6. Whitespace-only input returns empty array
  7. Content hash is a valid SHA-256 hex string
  8. `chunkIndex` values are sequential starting at 0
  9. Single paragraph shorter than 600 tokens produces exactly one chunk

- [ ] T040 [P] Create unit tests for the knowledge service at `tests/unit/modules/knowledge/knowledge.service.test.ts`. Mock `getPayloadClient`, `createQstashClient`, `createLlamaParseClient`, and `createOpenAIClient`. Test:
  1. `getFilesForWorkspace` calls Payload `find` with correct workspace filter and `overrideAccess: false`
  2. `retryIngestion` throws if file is not in `failed` state
  3. `retryIngestion` correctly determines restart stage from `parse_status`
  4. `retryIngestion` uses owner-scoped reads for the file/job lookup and increments `attempt_count` correctly
  5. `parseFile` returns gracefully if file not found (deleted scenario)
  6. `chunkFile` deletes existing chunks before inserting new ones (idempotency)
  7. `embedFile` deletes existing vectors before inserting new ones (idempotency)
  8. `embedFile` cleans up partial vectors on OpenAI failure
  9. `uploadFile` enforces the 20-file workspace cap and uses owner-scoped access for the `knowledge_files` create path
  10. `deleteFile` performs owner-scoped lookup/delete and relies on the existing after-delete hook for cascading cleanup

- [ ] T041 [P] Create unit tests for provider factories at `tests/unit/core/providers/qstash-client.test.ts`. Test:
  1. `createQstashClient()` throws `QSTASH_NOT_CONFIGURED` when `QSTASH_TOKEN` is empty/undefined
  2. `createOpenAIClient()` throws `EXTERNAL_SERVICE_ERROR` when `OPENAI_API_KEY` is empty (test in same file or separate `openai-client.test.ts`)
  3. `createLlamaParseClient()` throws `EXTERNAL_SERVICE_ERROR` when `LLAMA_PARSE_API_KEY` is empty (test in same file or separate `llama-parse-client.test.ts`)

- [ ] T042 [P] Create integration tests for the job pipeline at `tests/integration/jobs/ingest-pipeline.integration.test.ts`. These tests should mock QStash signature verification (so the route handler can be called directly) and mock external services (LlamaParse, OpenAI). Test:
  1. `ingest-parse` route returns `200` when file is not found (deleted file scenario)
  2. `ingest-parse` route returns `200` on successful parse and enqueues `ingest-chunk`
  3. `ingest-chunk` route returns `200` and creates `knowledge_chunks` records
  4. `ingest-embed` route returns `200` and inserts `knowledge_vectors` rows
  5. `ingest-parse` route returns `400` for invalid/missing body fields
  6. Duplicate delivery (idempotency): calling `ingest-chunk` twice for the same file does not create duplicate chunks
  7. A transient parsing failure (mocked LlamaParse SDK network error) causes the service to throw, the route to return `500`, so QStash retries
  8. A terminal parse failure (empty LlamaParse output) causes the service to persist failed state and return normally, so the route returns `200` and QStash does not retry
  9. A transient embedding failure (mocked OpenAI SDK error) causes the route to return `500` after persisting failure state and verifies partial vectors are cleaned up

- [ ] T043 After T044 is complete, run the full validation suite: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Fix any errors. All four commands must pass cleanly on the final generated-types state.

- [ ] T044 Run `pnpm payload generate:types` to regenerate `src/payload-types.ts` with the new `parsed_content` field on `knowledge_files`. **Before running, read `.agents/skills/payload/SKILL.md` for guidance on type generation.** If the generated types cause new type errors elsewhere, fix those errors, then proceed to T043 for the final validation pass.

- [ ] T045 Perform a manual quickstart validation following `specs/004-knowledge-ingestion/quickstart.md`. Verify:
  1. A PDF file can be uploaded and progresses to "Indexed"
  2. A CSV file can be uploaded and progresses to "Indexed"
  3. The Knowledge Uploads page shows correct per-file statuses
  4. The dashboard shows the knowledge freshness card
  5. Retry works for a failed file
  6. Delete removes all artifacts
  7. The 20-file limit is enforced
  Update `specs/004-knowledge-ingestion/spec.md` status from `Draft` to `Implemented`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phase 2 (but Phase 3 uploads are needed to test the pipeline)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs upload UI and file list component)
- **User Story 4 (Phase 6)**: Depends on Phase 5 (needs file row component to add retry button)
- **User Story 5 (Phase 7)**: Depends on Phase 5 (needs file row component to add delete button)
- **User Story 6 (Phase 8)**: Depends on Phase 2 (needs knowledge service), independent of other stories
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Upload)**: Can start after Phase 2 — no other story dependencies
- **US2 (Pipeline)**: Can start after Phase 2 — needs US1 to test with real uploaded files
- **US3 (View List)**: Can start after US1 — needs upload infrastructure for file list
- **US4 (Retry)**: Depends on US3 — needs file row component to add retry button
- **US5 (Delete)**: Depends on US3 — needs file row component to add delete button
- **US6 (Dashboard)**: Independent of US1–US5 — needs only Phase 2 service methods

### Within Each User Story

- Feature scaffold before actions
- Actions before UI components that call them
- Server components before client components that they render
- Page route last (after all components exist)

### Parallel Opportunities

- T002, T003, T004, T005 can all run in parallel (different files, no dependencies)
- T039, T040, T041, T042 can all run in parallel (different test files)
- US6 can run in parallel with US4/US5 (independent dashboard widget)

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task T002: "Add error codes to src/core/errors/error-codes.ts"
Task T003: "Create QStash provider at src/core/providers/qstash-client.ts"
Task T004: "Create LlamaParse provider at src/core/providers/llama-parse-client.ts"
Task T005: "Create OpenAI provider at src/core/providers/openai-client.ts"
```

## Parallel Example: Phase 9 Tests

```bash
# Launch all test tasks together:
Task T039: "Unit tests for chunker"
Task T040: "Unit tests for knowledge service"
Task T041: "Unit tests for provider factories"
Task T042: "Integration tests for job pipeline"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (knowledge module + chunker)
3. Complete Phase 3: US1 (upload)
4. Complete Phase 4: US2 (pipeline)
5. **STOP and VALIDATE**: Upload a file and verify it reaches "Indexed" status

### Incremental Delivery

1. Setup + Foundational → Building blocks ready
2. US1 (Upload) → Files can be submitted
3. US2 (Pipeline) → Files are processed end-to-end
4. US3 (View List) → Owner sees status in dashboard
5. US4 (Retry) → Failed files can be retried
6. US5 (Delete) → Files can be cleaned up
7. US6 (Dashboard) → At-a-glance knowledge health

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All Payload operations must use the local Payload skill as reference
- `overrideAccess: false` for user-facing operations; `overrideAccess: true` only for system/internal operations
- Do NOT implement retrieval, AI reply generation, or conversation runtime logic — this spec covers ingestion only
- All job routes return `200` for successful completion, safe no-ops (deleted file), and terminal business failures (empty content, zero chunks); only transient infrastructure errors return non-2xx for QStash retry
- Idempotency: each pipeline stage cleans existing data before inserting
- File deletion during in-progress ingestion: pipeline gracefully no-ops on deleted files
