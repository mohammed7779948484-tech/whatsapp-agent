# Tasks: Database Setup

**Input**: Design documents from `/specs/002-database-setup/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), quickstart.md (✅)

**Tests**: Not explicitly requested in the spec. Test tasks are excluded. Testing infrastructure already exists from Phase 1.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**⚠️ PAYLOAD SKILL REQUIREMENT**: Many tasks in this spec involve Payload CMS collections, access control, hooks, uploads, migrations, and the multi-tenant plugin. For ANY Payload-related task, the implementing model MUST:
1. Read `.agents/skills/payload/SKILL.md` before starting
2. Read the relevant reference files under `.agents/skills/payload/reference/` (especially `COLLECTIONS.md`, `FIELDS.md`, `ACCESS-CONTROL.md`, `HOOKS.md`, `ADAPTERS.md`, `QUERIES.md`)
3. Use those files as the primary source of truth — do NOT guess Payload behavior from memory
4. Follow the approved constitution (`.specify/memory/constitution.md`), feature template, and module template while implementing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new access control functions, hook utilities, and migration files that multiple user stories depend on. These are shared building blocks.

- [X] T001 Create the reusable workspace-scoped access control function in `src/payload/access/workspace-scope.access.ts` — this function takes a Payload access control argument, extracts the authenticated user, resolves the user's workspace from the plugin-managed tenants array, and returns a `where` constraint scoping queries to `workspace: { equals: workspaceId }`. It must return `false` (deny all) for unauthenticated requests. Admin users should receive unrestricted access (return `true`). **Before implementing**: read `.agents/skills/payload/reference/ACCESS-CONTROL.md` and `.agents/skills/payload/reference/ACCESS-CONTROL-ADVANCED.md`. Reference the existing `src/payload/access/can-read-own-workspace.access.ts` as a pattern example.

- [X] T002 [P] Create the workspace-owner CRUD access control function in `src/payload/access/workspace-owner-crud.access.ts` — similar to T001 but allows owners to create/update/delete records within their own workspace. Admin users get unrestricted access. Used by `knowledge_files` collection where owners need full CRUD within their workspace. **Before implementing**: read `.agents/skills/payload/reference/ACCESS-CONTROL.md`.

- [X] T003 [P] Create the admin-only traces access control function in `src/payload/access/traces-admin-only.access.ts` — returns `true` only if `user.role === 'admin'`; returns `false` for all other roles including `owner`. Used on the `message_traces` collection for all operations (read/create/update/delete). **Before implementing**: read `.agents/skills/payload/reference/ACCESS-CONTROL.md`. Reference the existing `src/payload/access/is-admin.access.ts` as a pattern example.

- [X] T004 [P] Create the reusable one-per-workspace `beforeChange` hook in `src/payload/hooks/enforce-one-per-workspace.hook.ts` — this is a factory function that accepts a `collectionSlug` parameter and returns a Payload `beforeChange` hook function. The hook checks if a record already exists in the given collection for the same workspace. It must: (1) only run on `create` operations (not `update`), (2) query the collection with `where: { workspace: { equals: incomingWorkspaceId } }` and `limit: 1`, (3) if a match is found, throw an `AppError` with a clear message like `"Only one ${collectionSlug} is allowed per workspace"` and error code `DUPLICATE_RESOURCE`, (4) if no match, allow the operation to proceed. Import `AppError` from `@/core/errors/app-error`. **Before implementing**: read `.agents/skills/payload/reference/HOOKS.md` and `.agents/skills/payload/SKILL.md`.

- [X] T005 [P] Create the knowledge vectors migration file at `src/payload/migrations/00002_create_knowledge_vectors.ts` — this migration creates the `knowledge_vectors` SQL table using raw SQL via `payload.db.execute(...)`. The SQL must: (1) `CREATE TABLE IF NOT EXISTS knowledge_vectors (id SERIAL PRIMARY KEY, workspace_id INTEGER NOT NULL, file_id INTEGER NOT NULL, chunk_id INTEGER NOT NULL, embedding vector(1536) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`, (2) create a B-tree index on `workspace_id`, (3) create a B-tree index on `file_id`, (4) create a B-tree index on `chunk_id`, (5) create an HNSW index on `embedding` using cosine distance: `CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_embedding ON knowledge_vectors USING hnsw (embedding vector_cosine_ops)`. The `down` function must drop the table. Follow the exact same code pattern used in the existing `src/payload/migrations/00001_enable_pgvector.ts`. **Before implementing**: read the existing migration at `src/payload/migrations/00001_enable_pgvector.ts` and follow its type patterns.

- [X] T006 Update the access control barrel export in `src/payload/access/index.ts` — add exports for the three new access functions created in T001, T002, and T003: `workspace-scope.access`, `workspace-owner-crud.access`, and `traces-admin-only.access`. Keep all existing exports intact.

**Checkpoint**: Shared access control functions, the one-per-workspace hook factory, and the vector migration are ready. Collection implementation can now begin.

---

## Phase 2: Foundational Collections (Blocking Prerequisites)

**Purpose**: Create the core tenant-owned collections that multiple user stories depend on. These collections must exist before any story-specific logic can be added.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**⚠️ PAYLOAD SKILL**: Before implementing ANY collection task in this phase, read:
- `.agents/skills/payload/SKILL.md`
- `.agents/skills/payload/reference/COLLECTIONS.md`
- `.agents/skills/payload/reference/FIELDS.md`
- `.agents/skills/payload/reference/ACCESS-CONTROL.md`

Do NOT guess Payload collection syntax from memory. Use the local reference files as the source of truth.

- [X] T007 Extend the existing `workspaces` collection in `src/payload/collections/workspaces.collection.ts` — add TWO new fields: (1) `owner` field: a `relationship` field pointing to the `users` collection, not required, positioned in sidebar, with admin description "The owner user assigned to this workspace"; (2) `last_knowledge_update_at` field: a `date` field, not required, with admin description "Last time knowledge was successfully indexed." Do NOT remove or modify any existing fields (`name`, `slug`, `status`). Do NOT change the existing access control. Keep all existing imports and configuration intact.

- [X] T008 Create the `agents` collection in `src/payload/collections/agents.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `display_name` (text, required), `response_style` (textarea, not required), `system_prompt` (textarea, not required), `quick_instructions` (textarea, not required), `language_preference` (select with options `ar` and `en`, not required), `is_enabled` (checkbox, required, defaultValue true). **Admin config**: `useAsTitle: 'display_name'`, group: `'Tenant Data'`. **Access control**: use `isAdmin` for create/delete, use `workspaceScope` (from T001) for read, use `workspaceOwnerCrud` (from T002) for update. **Hooks**: add the `enforceOnePerWorkspace` hook (from T004) as a `beforeChange` hook with `collectionSlug: 'agents'`. **Enable timestamps**: `timestamps: true`. **Before implementing**: read `.agents/skills/payload/reference/COLLECTIONS.md`, `FIELDS.md`, and `HOOKS.md`.

- [X] T009 [P] Create the `whatsapp_sessions` collection in `src/payload/collections/whatsapp-sessions.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `session_name` (text, required), `provider_status` (select: `connected`, `disconnected`, `qr_pending`, `error`; required, defaultValue `disconnected`), `qr_code` (textarea, not required), `connected_phone` (text, not required), `last_synced_at` (date, not required), `last_error` (textarea, not required). **Admin config**: `useAsTitle: 'session_name'`, group: `'Tenant Data'`. **Access control**: use `isAdmin` for create/update/delete, use `workspaceScope` (from T001) for read. **Hooks**: add the `enforceOnePerWorkspace` hook (from T004) as a `beforeChange` hook with `collectionSlug: 'whatsapp_sessions'`. **Enable timestamps**: `timestamps: true`.

- [X] T010 [P] Create the `conversations` collection in `src/payload/collections/conversations.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `remote_jid` (text, required), `session_started_at` (date, required), `last_message_at` (date, required), `status` (select: `open`, `closed`; required, defaultValue `open`). **Admin config**: `useAsTitle: 'remote_jid'`, group: `'Tenant Data'`. **Access control**: use `isAdmin` for create/update/delete, use `workspaceScope` (from T001) for read. **Enable timestamps**: `timestamps: true`.

- [X] T011 [P] Create the `messages` collection in `src/payload/collections/messages.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `conversation` (relationship → conversations, required), `direction` (select: `inbound`, `outbound`; required), `provider_message_id` (text, not required), `text` (textarea, required), `message_type` (select: `text`, `image`, `audio`, `video`, `document`, `other`; required, defaultValue `text`), `delivery_status` (select: `sent`, `delivered`, `read`, `failed`; not required). **Admin config**: group: `'Tenant Data'`. **Access control**: use `isAdmin` for create/update/delete, use `workspaceScope` (from T001) for read. **Enable timestamps**: `timestamps: true`. **Note**: The spec's `created_at` field (FR-006) is satisfied by Payload's automatic `createdAt` timestamp from `timestamps: true` — do NOT create a separate `created_at` field.

- [X] T012 [P] Create the `message_traces` collection in `src/payload/collections/message-traces.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `conversation` (relationship → conversations, required), `inbound_message` (relationship → messages, required), `outbound_message` (relationship → messages, not required), `prompt_snapshot` (textarea, not required), `retrieved_chunks_snapshot` (json, not required), `model_name` (text, not required), `used_fallback` (checkbox, required, defaultValue false), `fallback_reason` (text, not required), `send_status` (select: `sent`, `failed`; not required), `error_details` (textarea, not required). **Admin config**: group: `'Admin Only'`. **Access control**: use `tracesAdminOnly` (from T003) for ALL operations (read/create/update/delete) — owners MUST NOT access traces. **Enable timestamps**: `timestamps: true`.

- [X] T013 [P] Create the `ingestion_jobs` collection in `src/payload/collections/ingestion-jobs.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `file` (relationship → knowledge_files, required), `stage` (select: `queued`, `parsing`, `chunking`, `embedding`, `indexed`, `failed`; required, defaultValue `queued`), `attempt_count` (number, required, defaultValue 0), `last_error` (textarea, not required), `started_at` (date, not required), `finished_at` (date, not required). **Admin config**: group: `'Tenant Data'`. **Access control**: use `isAdmin` for create/update/delete, use `workspaceScope` (from T001) for read. **Enable timestamps**: `timestamps: true`.

**Checkpoint**: All foundational collections exist. Knowledge file collection (which needs upload + hooks) and story-specific configurations come next.

---

## Phase 3: User Story 3 — Knowledge File and Chunk Collections (Priority: P1) 🎯

**Goal**: Create the upload-enabled `knowledge_files` collection and the `knowledge_chunks` collection with cascade deletion hooks. These are the most complex collections due to the upload integration and lifecycle hooks.

**Independent Test**: In the Payload Admin panel, create a knowledge file record. Create associated knowledge chunks. Delete the knowledge file and verify all associated chunks are removed.

### Implementation for User Story 3

- [X] T014 [US3] Create the `knowledge_files` collection in `src/payload/collections/knowledge-files.collection.ts` — This collection MUST be upload-enabled. **Upload config**: set `upload: { mimeTypes: ['application/pdf', 'text/csv'] }`. Check the Payload skill for the exact upload configuration syntax — read `.agents/skills/payload/reference/COLLECTIONS.md` and `.agents/skills/payload/reference/ADAPTERS.md`. **Fields**: `workspace` (relationship → workspaces, required), `filename` (text, not required — Payload may populate via upload metadata), `mime_type` (text, not required), `filesize` (number, not required), `parse_status` (select: `pending`, `parsing`, `parsed`, `failed`; required, defaultValue `pending`), `ingestion_status` (select: `pending`, `processing`, `indexed`, `failed`; required, defaultValue `pending`), `ingestion_error` (textarea, not required), `uploaded_at` (date, required), `parsed_at` (date, not required), `indexed_at` (date, not required). **Admin config**: `useAsTitle: 'filename'`, group: `'Tenant Data'`. **Access control**: use `workspaceOwnerCrud` (from T002) for read/create/update/delete — owners can manage their own files. **Enable timestamps**: `timestamps: true`. **Note**: The spec's `url` field (FR-003) is auto-managed by Payload's upload system — Payload automatically provides file URL metadata for upload-enabled collections. Do NOT create a separate `url` field.

- [X] T015 [US3] Create the `knowledge_chunks` collection in `src/payload/collections/knowledge-chunks.collection.ts` — **Fields**: `workspace` (relationship → workspaces, required), `file` (relationship → knowledge_files, required), `chunk_index` (number, required), `content` (textarea, required), `content_hash` (text, required), `metadata_json` (json, not required). **Admin config**: group: `'Tenant Data'`. **Access control**: use `isAdmin` for create/update/delete (chunks are system-managed), use `workspaceScope` (from T001) for read. **Enable timestamps**: `timestamps: true`.

- [X] T016 [US3] Create the knowledge file `beforeChange` hook in `src/payload/hooks/knowledge-file-before-change.hook.ts` — This hook runs on `create` operations only. It sets `uploaded_at` to `new Date()` if not already set. It ensures `parse_status` is `'pending'` and `ingestion_status` is `'pending'` on creation. **Before implementing**: read `.agents/skills/payload/reference/HOOKS.md` for the exact `beforeChange` hook signature and how to access `operation` (create vs update) and `data`. Import types from `payload`.

- [X] T017 [US3] Create the knowledge file `afterDelete` hook in `src/payload/hooks/knowledge-file-after-delete.hook.ts` — This hook runs after a knowledge file is deleted and performs cascade cleanup: (1) Delete all `knowledge_chunks` where `file` equals the deleted document's ID, using `payload.delete({ collection: 'knowledge_chunks', where: { file: { equals: doc.id } } })` with `overrideAccess: true` (this is an internal system operation, not user-facing). (2) Delete all rows from the `knowledge_vectors` SQL table where `file_id` equals the deleted document's ID, using `payload.db.execute(...)` with raw SQL: `DELETE FROM knowledge_vectors WHERE file_id = ${doc.id}`. (3) Log the deletion using the structured logger from `@/core/logger`. **Before implementing**: read `.agents/skills/payload/reference/HOOKS.md` for the exact `afterDelete` hook signature. Read the existing migration file `src/payload/migrations/00001_enable_pgvector.ts` for the pattern of executing raw SQL via `payload.db`.

- [X] T018 [US3] Wire the hooks into the `knowledge_files` collection — Edit `src/payload/collections/knowledge-files.collection.ts` to add the `hooks` property: `hooks: { beforeChange: [knowledgeFileBeforeChange], afterDelete: [knowledgeFileAfterDelete] }`. Import both hooks from their respective files in `src/payload/hooks/`. **Before implementing**: read `.agents/skills/payload/reference/HOOKS.md` for how collection-level hooks are registered.

**Checkpoint**: Knowledge file and chunk collections exist with lifecycle hooks. Upload integration with R2 will be wired in the next phase.

---

## Phase 4: User Story 3 continued — R2 Storage Integration and Registration (Priority: P1)

**Goal**: Register the `knowledge_files` collection with the S3 storage adapter so uploads are routed to Cloudflare R2, and register ALL new collections in the Payload config.

**Independent Test**: After registration, create a knowledge file via Admin panel upload. Verify the file is stored in R2 (check Payload logs for S3 adapter activity). Verify all new collections appear in the Admin sidebar.

### Implementation for User Story 3 (continued)

- [ ] T019 [US3] Update the collection barrel export in `src/payload/collections/index.ts` — add exports for ALL eight new collections: `Agents`, `WhatsappSessions`, `KnowledgeFiles`, `KnowledgeChunks`, `Conversations`, `Messages`, `MessageTraces`, `IngestionJobs`. Keep the existing `Users` and `Workspaces` exports. Each export should re-export the collection config from its source file.

- [ ] T020 [US3] Update `src/payload/payload.config.ts` to register all new collections — add all eight new collections to the `collections` array: `[Users, Workspaces, Agents, WhatsappSessions, KnowledgeFiles, KnowledgeChunks, Conversations, Messages, MessageTraces, IngestionJobs]`. Import them from `./collections/index.ts` or their individual files. **Before implementing**: read `.agents/skills/payload/SKILL.md` and the existing `payload.config.ts` to understand the current configuration shape.

- [ ] T021 [US3] Update the `s3Storage` plugin config in `src/payload/payload.config.ts` to register `knowledge_files` for R2 storage — change `collections: {}` to `collections: { knowledge_files: { prefix: 'knowledge' } }` (or the appropriate Payload s3Storage configuration format). This tells the S3 adapter to handle uploads for the `knowledge_files` collection. **Before implementing**: read `.agents/skills/payload/reference/ADAPTERS.md` for the exact `s3Storage` collection registration syntax. The key is the collection slug, not the TypeScript variable name.

**Checkpoint**: All collections are registered in Payload config. Knowledge file uploads are routed to R2 via the S3 adapter. All collections visible in Admin panel.

---

## Phase 5: User Story 7 — Tenant Safety and Invariant Enforcement (Priority: P1)

**Goal**: Implement the workspace deletion guard and verify that all access control and invariant constraints are working correctly across the complete data model.

**Independent Test**: (1) Attempt to delete a workspace that has an agent — verify rejection. (2) Attempt to create a second agent for a workspace — verify rejection. (3) As an owner, attempt to read data from another workspace — verify empty results. (4) As an owner, attempt to read message traces — verify denied.

### Implementation for User Story 7

- [ ] T022 [US7] Create the workspace `beforeDelete` guard hook in `src/payload/hooks/workspace-before-delete.hook.ts` — This hook prevents deletion of a workspace if any dependent records exist. It must: (1) query `agents` for any records where `workspace` equals the workspace being deleted, (2) query `whatsapp_sessions` for any records where `workspace` equals the workspace being deleted, (3) query `knowledge_files` for any records where `workspace` equals the workspace being deleted, (4) query `conversations` for any records where `workspace` equals the workspace being deleted. If ANY of these queries return a count > 0, throw an `AppError` with message `"Cannot delete workspace: dependent records exist. Remove all agents, sessions, files, and conversations first."` and error code `WORKSPACE_HAS_DEPENDENCIES`. Use `payload.count(...)` for efficiency rather than `payload.find(...)`. Use `overrideAccess: true` for these internal system queries. **Before implementing**: read `.agents/skills/payload/reference/HOOKS.md` and `.agents/skills/payload/reference/QUERIES.md`.

- [ ] T023 [US7] Wire the workspace `beforeDelete` hook into the existing `workspaces` collection — Edit `src/payload/collections/workspaces.collection.ts` to add `hooks: { beforeDelete: [workspaceBeforeDelete] }`. Import the hook from `src/payload/hooks/workspace-before-delete.hook.ts`. Do NOT modify any other existing configuration (fields, access, admin config).

- [ ] T024 [US7] Add the `DUPLICATE_RESOURCE`, `WORKSPACE_HAS_DEPENDENCIES`, and `OWNER_ALREADY_ASSIGNED` error codes to `src/core/errors/error-codes.ts` — add three new exported constants: `export const DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE'`, `export const WORKSPACE_HAS_DEPENDENCIES = 'WORKSPACE_HAS_DEPENDENCIES'`, and `export const OWNER_ALREADY_ASSIGNED = 'OWNER_ALREADY_ASSIGNED'`. Keep all existing error codes intact.

- [ ] T025 [US7] Enforce the one-owner-per-workspace invariant (FR-025) — Create a `beforeChange` hook in `src/payload/hooks/enforce-one-owner-per-workspace.hook.ts`. This hook runs on the `workspaces` collection when the `owner` field is being set or changed. It must: (1) only activate when `data.owner` is set and is different from the existing `originalDoc.owner`, (2) query the `users` collection to check if the target owner user is already assigned as owner to a different workspace (i.e., another workspace already has `owner: { equals: targetUserId }`), (3) if the target user is already an owner of another workspace, throw an `AppError` with message `"This user is already the owner of another workspace"` and error code `OWNER_ALREADY_ASSIGNED`, (4) allow the operation if no conflict exists. Use `overrideAccess: true` for the internal query. **Before implementing**: read `.agents/skills/payload/reference/HOOKS.md`. Then wire this hook into the `workspaces` collection's `hooks.beforeChange` array in `src/payload/collections/workspaces.collection.ts`, alongside the existing `beforeDelete` hook from T023.

- [ ] T026 [US7] Verify all access control is correctly wired by inspecting each collection — manually verify (no code changes unless issues found) that: (1) `agents` uses `workspaceScope` for read, `isAdmin` for create/delete, `workspaceOwnerCrud` for update, and has `enforceOnePerWorkspace` beforeChange hook; (2) `whatsapp_sessions` uses `workspaceScope` for read, `isAdmin` for create/update/delete, and has `enforceOnePerWorkspace` beforeChange hook; (3) `knowledge_files` uses `workspaceOwnerCrud` for all operations and has both hooks wired; (4) `knowledge_chunks` uses `workspaceScope` for read, `isAdmin` for create/update/delete; (5) `conversations`, `messages` use `workspaceScope` for read, `isAdmin` for create/update/delete; (6) `message_traces` uses `tracesAdminOnly` for ALL operations; (7) `ingestion_jobs` uses `workspaceScope` for read, `isAdmin` for create/update/delete; (8) `workspaces` has both `beforeDelete` (guard) and `beforeChange` (one-owner enforcement) hooks wired. Fix any mismatches found.

**Checkpoint**: All invariants (one-agent, one-session, one-owner per workspace) and safety guards (workspace deletion guard, owner isolation, admin-only traces) are enforced.

---

## Phase 6: User Story 5 — Vector Storage (Priority: P1)

**Goal**: Run the migration to create the `knowledge_vectors` SQL table and verify it exists with correct indexes.

**Independent Test**: Run `pnpm payload migrate`, then query `SELECT * FROM pg_tables WHERE tablename = 'knowledge_vectors'` — table exists. Query `SELECT indexname FROM pg_indexes WHERE tablename = 'knowledge_vectors'` — all indexes exist.

### Implementation for User Story 5

- [ ] T027 [US5] Run `pnpm payload migrate` to execute the new migration `00002_create_knowledge_vectors.ts` (created in T005) — verify the migration completes without errors. Then verify: (1) the `knowledge_vectors` table exists by querying `SELECT * FROM pg_tables WHERE tablename = 'knowledge_vectors'`, (2) the HNSW index on embedding exists, (3) B-tree indexes on workspace_id, file_id, and chunk_id exist.

**Checkpoint**: Vector table and indexes are operational. The table is ready for use by the ingestion pipeline in Phase 4 of the master plan.

---

## Phase 7: User Story 8 — Development Seed Script (Priority: P2)

**Goal**: Create a development seed script that populates a complete workspace environment for downstream development and testing.

**Independent Test**: Run `pnpm seed:dev` after `pnpm seed:admin`. Verify a workspace exists with an agent, a WhatsApp session placeholder, and a sample knowledge file record. Run it again and verify no duplicates are created.

### Implementation for User Story 8

- [ ] T028 [US8] Create the development seed script at `scripts/seed-dev.mjs` — This script creates a representative workspace environment for development. It must: (1) get the Payload instance using the same pattern as `scripts/seed-admin.mjs` (read that file first to understand the pattern), (2) check if a workspace with slug `dev-workspace` already exists — if yes, log "Seed data already exists, skipping" and exit (idempotency), (3) create a workspace: `{ name: 'Dev Workspace', slug: 'dev-workspace', status: 'active' }`, (4) find the admin user (first user with `role: 'admin'`), (5) create an owner user: `{ email: 'owner@dev.local', password: 'owner-dev-password-123', role: 'owner' }` and assign the workspace via the plugin-managed tenants array, (6) update the workspace with `owner` relation pointing to the new owner, (7) create an agent: `{ workspace: workspaceId, display_name: 'Dev Store Assistant', response_style: 'Friendly and helpful', system_prompt: 'You are a helpful store assistant.', is_enabled: true }`, (8) create a WhatsApp session placeholder: `{ workspace: workspaceId, session_name: 'workspace_' + workspaceId, provider_status: 'disconnected' }`, (9) create a sample knowledge file record (metadata only, no actual file upload): `{ workspace: workspaceId, filename: 'sample-product-catalog.pdf', mime_type: 'application/pdf', filesize: 0, parse_status: 'pending', ingestion_status: 'pending', uploaded_at: new Date() }`. Use `overrideAccess: true` for all seed operations. Log each step clearly. **Before implementing**: read `scripts/seed-admin.mjs` to understand the Payload initialization pattern used in seed scripts.

- [ ] T029 [US8] Add the `seed:dev` npm script to `package.json` — add `"seed:dev": "node scripts/seed-dev.mjs"` to the `scripts` section. Place it after the existing `seed:admin` script.

**Checkpoint**: Running `pnpm seed:admin && pnpm seed:dev` creates a complete development environment with a workspace, owner, agent, WhatsApp session, and sample knowledge file.

---

## Phase 8: User Story 6 — Retention Scaffolding (Priority: P2)

**Goal**: Create a retention cleanup scaffolding mechanism (FR-026) capable of identifying stale conversations, messages, and traces older than the configured retention period.

**Independent Test**: Import the retention query helper and call it with a test date. Verify it returns the correct query filter for records older than the retention period.

### Implementation for User Story 6

- [ ] T030 [US6] Create the retention cleanup query helper in `src/payload/lib/retention-cleanup.ts` — This file exports a function `getRetentionCleanupFilter(retentionDays: number = 30)` that returns a Payload `where` clause identifying records older than `retentionDays` days. The function must: (1) compute a cutoff date as `new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)`, (2) return `{ createdAt: { less_than: cutoffDate.toISOString() } }`. Also export a constant `DEFAULT_RETENTION_DAYS = 30`. This is scaffolding only — the actual scheduled cleanup job (via QStash cron) is deferred to a later phase. Add a JSDoc comment explaining that this function is called by the `cleanup-retention` job route when it is implemented in a future phase. **Before implementing**: read `.agents/skills/payload/reference/QUERIES.md` to verify the correct `less_than` operator syntax for date fields.

**Checkpoint**: Retention cleanup scaffolding exists. The actual scheduled execution belongs to a later phase.

---

## Phase 9: User Story 1 & 2 — Admin Verification (Priority: P1)

**Goal**: Verify that admin can create a complete customer environment through the Admin panel — workspace → owner → agent → WhatsApp session. This is a verification phase, not an implementation phase.

**Independent Test**: Log in as admin. Create a workspace, create an owner, assign the owner to the workspace, create an agent for the workspace, create a WhatsApp session. Verify all records exist and are properly linked.

### Verification for User Story 1 & 2

- [ ] T031 [US1] Regenerate Payload types by running `pnpm payload generate:types` — this updates `src/payload-types.ts` with type definitions for all new collections. Verify the generated file includes types for: `Agent`, `WhatsappSession`, `KnowledgeFile`, `KnowledgeChunk`, `Conversation`, `Message`, `MessageTrace`, `IngestionJob`. This task MUST be done after all collections are registered (T020).

- [ ] T032 [US1] Verify the complete admin workflow end-to-end — start the dev server with `pnpm dev`, log into Admin at `/admin`, and verify: (1) all 10 collections appear in the admin sidebar (Users, Workspaces, Agents, WhatsApp Sessions, Knowledge Files, Knowledge Chunks, Conversations, Messages, Message Traces, Ingestion Jobs), (2) create a workspace → succeeds, (3) create an agent for that workspace → succeeds, (4) attempt to create a second agent for the same workspace → rejected with clear error, (5) create a WhatsApp session for the workspace → succeeds, (6) attempt to create a second session for the same workspace → rejected with clear error, (7) the workspace `owner` and `last_knowledge_update_at` fields are visible and editable, (8) assign an owner to the workspace → succeeds, (9) attempt to assign the same owner to a different workspace → rejected with clear error (one-owner-per-workspace invariant).

**Checkpoint**: The admin can manage the complete customer data model through the Admin panel. All invariants are enforced.

---

## Phase 10: User Story 4 — Conversation and Message Verification (Priority: P1)

**Goal**: Verify that conversations, messages, and traces are properly linked and tenant-scoped.

**Independent Test**: Create a conversation, add messages in both directions, create a message trace. Verify all records are workspace-scoped and traces are admin-only.

### Verification for User Story 4

- [ ] T033 [US4] Verify conversation and message flow in Admin panel — (1) create a conversation linked to a workspace with a remote JID and session timestamps, (2) create an inbound message linked to the conversation, (3) create an outbound message linked to the conversation, (4) create a message trace linked to the conversation and messages with a prompt snapshot and model name, (5) verify all records show the correct workspace relation.

- [ ] T034 [US4] Verify message trace admin-only access — (1) log in as the owner user, (2) attempt to access message traces through the customer dashboard or API — verify no traces are returned, (3) log in as admin and verify traces ARE visible.

**Checkpoint**: Conversation, message, and trace collections are operational and tenant-scoped with correct admin-only trace visibility.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup across all stories.

- [ ] T035 Run `pnpm typecheck` and confirm zero errors across the entire codebase — all new collections, access functions, hooks, and type imports must compile cleanly
- [ ] T036 Run `pnpm lint` and confirm zero errors/warnings across the entire codebase
- [ ] T037 Run `pnpm build` and confirm successful production build
- [ ] T038 Run `pnpm payload migrate` and confirm all migrations execute without errors (both `00001_enable_pgvector.ts` and `00002_create_knowledge_vectors.ts`)
- [ ] T039 Run `pnpm seed:admin` followed by `pnpm seed:dev` on a fresh database and confirm both complete without errors and the seed data is correct (workspace + owner + agent + WhatsApp session + sample knowledge file)
- [ ] T040 [P] Update `.env.example` if any new environment variables were introduced (none expected, but verify)
- [ ] T041 Run the complete quickstart.md validation from `specs/002-database-setup/quickstart.md` end-to-end — verify all checklist items pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational Collections (Phase 2)**: Depends on Phase 1 completion (needs access functions and hooks) — BLOCKS all user stories
- **User Story 3 - Knowledge (Phase 3)**: Depends on Phase 2 (needs foundational collections pattern established)
- **User Story 3 continued - Registration (Phase 4)**: Depends on Phase 3 (needs all collections defined before registration)
- **User Story 7 - Tenant Safety (Phase 5)**: Depends on Phase 4 (needs collections registered in config)
- **User Story 5 - Vectors (Phase 6)**: Depends on Phase 1 (migration created in T005), can run after Phase 1
- **User Story 8 - Seed (Phase 7)**: Depends on Phase 4 (needs all collections registered)
- **User Story 6 - Retention Scaffolding (Phase 8)**: Depends on Phase 2 (needs collection patterns established)
- **User Story 1 & 2 - Admin Verification (Phase 9)**: Depends on Phases 4, 5, 6, 8 (needs everything registered and wired)
- **User Story 4 - Message Verification (Phase 10)**: Depends on Phase 9
- **Polish (Phase 11)**: Depends on all user stories being complete

### Parallel Opportunities

Within Phase 1, tasks T001–T005 can all run in parallel (different files, no dependencies between them).

Within Phase 2, tasks T008–T013 can all run in parallel (all are independent collection files). T007 (workspaces extension) should run first if other collections reference workspace shape.

### Within Each Phase

- Access control functions before collections that use them
- Hook factories before collections that register them
- Collections before barrel exports
- Barrel exports before payload.config.ts registration
- Registration before verification

---

## Parallel Example: Phase 1 (Setup)

```text
# All of these can run simultaneously (different files, no dependencies):
T001: Create workspace-scope.access.ts
T002: Create workspace-owner-crud.access.ts
T003: Create traces-admin-only.access.ts
T004: Create enforce-one-per-workspace.hook.ts
T005: Create 00002_create_knowledge_vectors.ts migration
```

## Parallel Example: Phase 2 (Foundational Collections)

```text
# After T007 (extend workspaces), these can all run simultaneously:
T008: Create agents.collection.ts
T009: Create whatsapp-sessions.collection.ts
T010: Create conversations.collection.ts
T011: Create messages.collection.ts
T012: Create message-traces.collection.ts
T013: Create ingestion-jobs.collection.ts
```

---

## Implementation Strategy

### MVP First (Phases 1–5)

1. Complete Phase 1: Setup (access functions + hooks + migration)
2. Complete Phase 2: Foundational Collections (all 6 base collections)
3. Complete Phase 3: Knowledge Collections (knowledge_files + knowledge_chunks + hooks)
4. Complete Phase 4: Registration (barrel export + payload.config.ts + S3 storage)
5. Complete Phase 5: Invariant enforcement (workspace guard + verification)
6. **STOP and VALIDATE**: All collections exist, access control works, invariants enforced

### Incremental Delivery

1. Setup → Shared building blocks ready
2. Foundational Collections → Core data model exists
3. Knowledge Collections → Upload-enabled collection with cascade hooks
4. Registration → Everything wired into Payload, Admin panel shows all collections
5. Invariant Enforcement → Safety guards active
6. Vector Table → Embedding storage ready
7. Seed Script → Development environment bootstrappable
8. Admin Verification → End-to-end admin workflow confirmed
9. Message Verification → Conversation/trace isolation confirmed
10. Polish → Ship-ready data layer

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **CRITICAL**: For ALL Payload-related tasks, the implementing model MUST read `.agents/skills/payload/SKILL.md` and the relevant reference files under `.agents/skills/payload/reference/` BEFORE writing any Payload code. Do not guess Payload syntax from memory.
- Follow the approved constitution (`.specify/memory/constitution.md`) for layering, naming, and import rules
- Follow the approved module template (`.specify/memory/standards/module-template.md`) for any module code
- Follow the approved feature template (`.specify/memory/standards/feature-template.md`) for any feature code
