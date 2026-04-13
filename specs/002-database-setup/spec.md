# Feature Specification: Database Setup

**Feature Branch**: `002-database-setup`
**Created**: 2026-04-04
**Status**: Implemented
**Input**: Phase 2 of the master implementation plan — create all tenant-owned Payload collections, access control rules, lifecycle hooks, the pgvector SQL table, invariant enforcement, retention scaffolding, and development seed scripts.

## Continuity from Phase 1

Phase 1 (Spec `001-project-foundation`) is complete and verified. The following artifacts are established and available as dependencies for this spec:

**Collections already implemented:**
- `users` — auth-enabled, role field (`admin`/`owner`), plugin-managed tenants array constrained to one workspace for owners
- `workspaces` — tenant root entity, name/slug/status fields, access control restricted to admins (create/update/delete) and owners (read own only)

**Infrastructure already implemented:**
- Payload CMS 3.79.1 configured with `@payloadcms/db-postgres` (Neon), `@payloadcms/storage-s3` (R2), and `@payloadcms/plugin-multi-tenant` (`tenantsSlug: 'workspaces'`)
- Environment validation with fail-fast behavior (`src/core/env.ts`)
- Auth session helpers (`src/core/auth/*`), including `require-owner-session`, `verify-workspace-session`, `get-owner-dashboard-session`
- `AppError` class and structured logger (`src/core/errors/*`, `src/core/logger/*`)
- Shared types: `ActionResult`, `WorkspaceStatus`, `invariant`, `safeJson`
- Feature registry (`src/features/_registry/*`)
- pgvector extension migration (`00001_enable_pgvector.ts`)
- Health, job scaffold, and WAHA webhook placeholder routes (all returning 501 for jobs/webhooks)
- Payload access helpers: `is-admin.access.ts`, `is-owner.access.ts`, `is-admin-or-self.access.ts`, `can-read-own-workspace.access.ts`
- Payload lib: `get-payload.ts`, `with-tenant-context.ts`
- Collection barrel export: `src/payload/collections/index.ts`

**What this spec must NOT duplicate:**
- `users` collection — already exists; this spec may reference but must not recreate
- `workspaces` collection — already exists; this spec may extend with new fields (e.g., `owner` relation, `last_knowledge_update_at`) but must not recreate the existing fields
- pgvector extension migration — already exists; this spec creates the `knowledge_vectors` SQL table, not the extension itself
- Environment validation — already exists; no changes needed
- Health and scaffold routes — already exist as placeholders

---

## User Scenarios & Testing

### User Story 1 — Admin Creates a Complete Customer Environment (Priority: P1)

An admin creates a workspace, creates an owner user assigned to that workspace, and creates exactly one agent for that workspace. The system enforces that each workspace can have only one agent and only one owner. The agent record stores configurable settings that will later power the AI response pipeline.

**Why this priority**: Without the agent and workspace data model, no downstream feature (knowledge upload, WhatsApp connection, AI replies) can function. This is the data backbone.

**Independent Test**: In the Payload Admin panel, create a workspace, create an owner, assign the owner to the workspace, then create an agent for the workspace. Verify the agent is linked to the workspace and the one-agent-per-workspace constraint is enforced by attempting to create a second agent for the same workspace.

**Acceptance Scenarios**:

1. **Given** an admin is logged into the Payload Admin panel, **When** they create a workspace and then create an agent with a display name, response style, and system prompt linked to that workspace, **Then** the agent record is persisted with the workspace relation and all fields are retrievable.
2. **Given** a workspace already has one agent, **When** an admin attempts to create a second agent for the same workspace, **Then** the system rejects the operation with a clear error message.
3. **Given** a workspace exists, **When** an admin creates an owner user and assigns that workspace, **Then** the owner's plugin-managed tenants array contains exactly one workspace reference.
4. **Given** a workspace with an owner and agent exists, **When** a read operation is performed with owner auth context, **Then** the owner can see their own workspace's agent but cannot see agents belonging to other workspaces.

---

### User Story 2 — WhatsApp Session Metadata Is Stored Per Workspace (Priority: P1)

Each workspace can have exactly one WhatsApp session record. This record tracks the WAHA session name, provider status, QR code state, connected phone metadata, and sync timestamps. The session is created during WhatsApp provisioning (Phase 3) but the collection and constraints must exist now.

**Why this priority**: The WhatsApp session data model is required before the WAHA integration feature can be built. Session lookup by workspace is a critical path for inbound message routing.

**Independent Test**: In the Payload Admin panel, create a WhatsApp session record linked to a workspace. Verify the session name follows the `workspace_${workspaceId}` convention. Attempt to create a second session for the same workspace and verify rejection.

**Acceptance Scenarios**:

1. **Given** a workspace exists, **When** an admin creates a WhatsApp session record for it, **Then** the record is stored with a session name, provider status, and workspace link.
2. **Given** a workspace already has a WhatsApp session, **When** a second session is created for the same workspace, **Then** the system rejects the duplicate.
3. **Given** a WhatsApp session record exists for workspace A, **When** an authenticated owner of workspace B queries sessions, **Then** they see no results.

---

### User Story 3 — Knowledge File Upload Metadata and Chunk Storage Are Ready (Priority: P1)

The system can store metadata for uploaded knowledge files (PDF, CSV) and their extracted chunks. Files are linked to a workspace. Chunks are linked to both files and workspaces. File deletion cascades to remove associated chunks.

**Why this priority**: The knowledge ingestion pipeline (Phase 4) depends on these collections existing with correct relations and cascade rules.

**Independent Test**: Create a `knowledge_files` record via Admin, then manually create associated `knowledge_chunks` records. Delete the file and verify all associated chunks are also removed.

**Acceptance Scenarios**:

1. **Given** a workspace exists, **When** a knowledge file record is created with workspace link, filename, mime type, and parse status, **Then** the record is persisted and retrievable.
2. **Given** a knowledge file with associated chunks exists, **When** the knowledge file is deleted, **Then** all associated chunks are also deleted.
3. **Given** two workspaces each have knowledge files, **When** the owner of workspace A reads knowledge files, **Then** they only see files belonging to workspace A.
4. **Given** a knowledge file exists, **When** chunks are created linked to that file and workspace, **Then** each chunk includes the chunk index, content, content hash, and metadata.

---

### User Story 4 — Conversation and Message History Is Persisted (Priority: P1)

The system stores conversations and messages per workspace. Conversations track session boundaries (24h window logic). Messages store direction, text, provider IDs, and timestamps. Message traces store the AI debug trail for admin visibility.

**Why this priority**: The AI reply pipeline (Phase 5) will persist messages and traces here. Without these collections, end-to-end message processing cannot complete.

**Independent Test**: Create a conversation linked to a workspace, add inbound and outbound messages, and create a message trace. Verify all records are persisted, tenant-scoped, and that traces are admin-visible only.

**Acceptance Scenarios**:

1. **Given** a workspace exists, **When** a conversation record is created with a remote JID and session timestamps, **Then** the conversation is persisted and scoped to the workspace.
2. **Given** a conversation exists, **When** inbound and outbound message records are added, **Then** each message stores direction, text, provider message ID, and timestamps.
3. **Given** a message trace record exists, **When** an owner queries message traces, **Then** they receive no results (traces are admin-only).
4. **Given** a message trace record exists, **When** an admin queries message traces, **Then** they can see the retrieved chunks snapshot, prompt snapshot, model name, fallback usage, and error details.

---

### User Story 5 — Vector Storage Supports Similarity Search (Priority: P1)

The system provides a dedicated SQL table for embedding vectors with appropriate indexes. Vectors are linked to workspaces, files, and chunks. Vector operations are scoped to a single workspace for tenant isolation.

**Why this priority**: The embedding storage table is required by the ingestion pipeline (Phase 4 — `ingest-embed`) and the retrieval service (Phase 5 — AI runtime).

**Independent Test**: Insert a test vector row through a migration or SQL helper. Query the vector table scoped to a specific workspace and verify the vector data, file linkage, and workspace scoping are correct.

**Acceptance Scenarios**:

1. **Given** the database is migrated, **When** the `knowledge_vectors` table is inspected, **Then** it exists with columns for workspace_id, file_id, chunk_id, embedding vector, and created_at.
2. **Given** vectors exist for two workspaces, **When** a similarity query is scoped to workspace A, **Then** only vectors from workspace A are considered.
3. **Given** a knowledge file with vectors exists, **When** the knowledge file is deleted, **Then** the associated vector rows are also removed.

---

### User Story 6 — Ingestion Job Lifecycle Is Tracked (Priority: P2)

The system tracks asynchronous ingestion jobs per knowledge file. Each job records its current stage, attempt count, last error, and timestamps. Failed jobs can be retried from the correct failed stage.

**Why this priority**: Stage tracking and retry logic in Phase 4 depend on the ingestion jobs collection existing with correct stage transitions.

**Independent Test**: Create an ingestion job record linked to a workspace and knowledge file. Update the job stage from `queued` to `parsing` to `indexed`. Verify stage transitions are stored, and error state can be set for the `failed` stage.

**Acceptance Scenarios**:

1. **Given** a knowledge file exists, **When** an ingestion job is created, **Then** it starts in the `queued` stage with attempt count 0.
2. **Given** an ingestion job in `parsing` stage fails, **When** the job error is recorded, **Then** the stage changes to `failed`, the error message is stored, and the attempt count is incremented.
3. **Given** a failed ingestion job exists, **When** a retry is triggered, **Then** a new attempt starts from the correct failed stage (not from the beginning).
4. **Given** two workspaces each have ingestion jobs, **When** the owner of workspace A reads ingestion jobs, **Then** they only see jobs for workspace A.

---

### User Story 7 — Tenant Safety and Invariant Enforcement (Priority: P1)

The system enforces critical v1 invariants at the data layer. Every tenant-owned collection enforces workspace scoping through access control. The one-owner-per-workspace, one-agent-per-workspace, and one-session-per-workspace constraints prevent invalid states.

**Why this priority**: Without invariant enforcement, any downstream feature could create invalid cross-tenant states or duplicate critical records. This is a security and correctness requirement.

**Independent Test**: Attempt to violate each invariant (create a second agent for one workspace, create a second WAHA session, query across workspace boundaries) and verify all are rejected.

**Acceptance Scenarios**:

1. **Given** access control is configured on all tenant-owned collections, **When** an owner queries any tenant-owned collection, **Then** results are filtered to their workspace only.
2. **Given** a workspace has one agent, **When** a second agent is created for the same workspace, **Then** the operation is rejected.
3. **Given** a workspace has one WhatsApp session, **When** a second session is created for the same workspace, **Then** the operation is rejected.
4. **Given** an owner of workspace A is authenticated, **When** they attempt to read data from workspace B, **Then** the query returns empty results.
5. **Given** a tenant-owned collection operation uses the Payload Local API, **When** it is called from a user-facing context, **Then** `overrideAccess: false` is enforced.

---

### User Story 8 — Development Seed Data Bootstraps a Working Environment (Priority: P2)

A developer or admin can run a seed script to populate a workspace with a sample agent, sample WhatsApp session, and sample knowledge file — enough to test downstream features without manual admin entry for every record.

**Why this priority**: Developer productivity during Phases 3–6 depends on having representative seed data. This reduces manual setup during development.

**Independent Test**: Run the dev seed script, verify that a complete workspace environment (workspace + owner + agent + WhatsApp session placeholder + sample knowledge file) is created in the database.

**Acceptance Scenarios**:

1. **Given** the database is empty, **When** the admin seed script runs followed by the dev seed script, **Then** a complete workspace environment exists with all required related records.
2. **Given** the seed script has already run once, **When** it runs a second time, **Then** it is idempotent — no duplicate records are created.

---

### Edge Cases

- What happens when a workspace is deleted that has dependent records (agents, sessions, files, conversations)?
- How does the system handle a knowledge file deletion that fails mid-cascade (chunks deleted but vectors not)?
- What happens if a workspace status changes to `disabled` while ingestion jobs are in progress?
- How does the system handle an owner assigned to a workspace that is subsequently deleted?
- What happens when a message trace references a conversation that has been cleaned up by retention?

---

## Requirements

### Functional Requirements

#### Collections

- **FR-001**: System MUST provide an `agents` collection with fields: workspace (relation), display_name, response_style, system_prompt, quick_instructions, language_preference, and is_enabled.
- **FR-002**: System MUST provide a `whatsapp_sessions` collection with fields: workspace (relation), session_name, provider_status, qr_code, connected_phone, last_synced_at, and last_error.
- **FR-003**: System MUST provide a `knowledge_files` collection as a Payload upload-enabled collection with workspace relation and metadata fields: filename, mime_type, filesize, url, parse_status, ingestion_status, ingestion_error, uploaded_at, parsed_at, indexed_at.
- **FR-004**: System MUST provide a `knowledge_chunks` collection with fields: workspace (relation), file (relation), chunk_index, content, content_hash, metadata_json.
- **FR-005**: System MUST provide a `conversations` collection with fields: workspace (relation), remote_jid, session_started_at, last_message_at, status (open/closed).
- **FR-006**: System MUST provide a `messages` collection with fields: workspace (relation), conversation (relation), direction (inbound/outbound), provider_message_id, text, message_type, created_at, delivery_status.
- **FR-007**: System MUST provide a `message_traces` collection with fields: workspace (relation), conversation (relation), inbound_message (relation), outbound_message (relation), prompt_snapshot, retrieved_chunks_snapshot, model_name, used_fallback, fallback_reason, send_status, error_details.
- **FR-008**: System MUST provide an `ingestion_jobs` collection with fields: workspace (relation), file (relation), stage (queued/parsing/chunking/embedding/indexed/failed), attempt_count, last_error, started_at, finished_at.
- **FR-009**: System MUST extend the existing `workspaces` collection with additional fields: `owner` (relation to users collection) and `last_knowledge_update_at` (date timestamp).

#### Vector Storage

- **FR-010**: System MUST provide a `knowledge_vectors` SQL table outside normal Payload collections, with columns: id, workspace_id, file_id, chunk_id, embedding (vector type), and created_at.
- **FR-011**: System MUST create HNSW vector similarity index on the `knowledge_vectors` table.
- **FR-012**: System MUST create standard indexes on workspace_id, file_id, and chunk_id columns.
- **FR-013**: Vector table MUST be created through a Payload migration file in `src/payload/migrations/`.

#### Access Control

- **FR-014**: System MUST apply tenant-scoped access control to all new tenant-owned collections so that owners can only read/write data within their assigned workspace.
- **FR-015**: System MUST restrict message trace reads to admin users only; owners MUST NOT be able to read traces.
- **FR-016**: System MUST restrict admin-level operations (create/update/delete workspaces, create users, manage agent configuration via Admin panel) to admin role exclusively.
- **FR-017**: All user-facing Payload Local API operations touching tenant data MUST specify `overrideAccess: false`.

#### Hooks and Lifecycle

- **FR-018**: System MUST implement a `knowledge_files` afterDelete hook that removes all associated `knowledge_chunks` and `knowledge_vectors` rows when a file is deleted.
- **FR-019**: System MUST implement a `knowledge_files` beforeChange hook that initializes ingestion metadata on file creation.
- **FR-020**: System MUST implement a workspace beforeDelete hook (or equivalent guard) that prevents deletion of workspaces with dependent tenant data.
- **FR-021**: System MUST implement a message trace beforeRead hook (or equivalent access rule) that filters traces to admin visibility only.

#### Invariant Enforcement

- **FR-022**: System MUST enforce that each workspace can have at most one agent (one-agent-per-workspace invariant).
- **FR-023**: System MUST enforce that each workspace can have at most one WhatsApp session (one-session-per-workspace invariant).
- **FR-024**: System MUST enforce that each owner has exactly one workspace assignment (already implemented via plugin-managed tenants array constraint from Phase 1).
- **FR-025**: System MUST enforce that each workspace has at most one owner (one-owner-per-workspace invariant).

#### Retention Scaffolding

- **FR-026**: System MUST provide a cleanup scaffolding mechanism capable of identifying conversations, messages, and traces older than the configured retention period (default: 30 days).

#### Seed Data

- **FR-027**: System MUST provide a dev seed script that creates a representative workspace environment (agent, WhatsApp session placeholder, sample knowledge file) for development and testing.
- **FR-028**: Seed script MUST be idempotent — running it multiple times must not create duplicates.

### Key Entities

- **Agent**: The customer-configured AI assistant belonging to one workspace. Stores display name, response style, system prompt, quick instructions, language preference, and enabled state.
- **WhatsApp Session**: WAHA session metadata for one workspace. Tracks session name, provider status, QR code, connected phone, and sync timestamps.
- **Knowledge File**: An uploaded PDF or CSV file owned by a workspace. Tracks upload state, parse status, and ingestion lifecycle.
- **Knowledge Chunk**: An extracted text segment from a knowledge file. Contains the chunk text, ordering index, content hash, and metadata.
- **Knowledge Vector**: An embedding vector in the dedicated SQL table, linked to a workspace, file, and chunk. Used for similarity search during AI retrieval.
- **Conversation**: A chat session thread within one workspace, bounded by the 24-hour session window.
- **Message**: An inbound or outbound text message within a conversation. Tracks direction, provider IDs, text, and delivery status.
- **Message Trace**: The AI debug trail for one inbound message. Records retrieved chunks, prompt snapshot, model outcome, and error details. Visible to admins only.
- **Ingestion Job**: The async processing lifecycle record for a knowledge file. Tracks stage, attempts, errors, and timestamps.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All nine new collections (agents, whatsapp_sessions, knowledge_files, knowledge_chunks, conversations, messages, message_traces, ingestion_jobs) plus the extended workspaces collection exist and are accessible through the admin panel.
- **SC-002**: The knowledge_vectors SQL table exists with appropriate indexes and supports vector insert/query operations.
- **SC-003**: Owner users can only see and interact with records belonging to their assigned workspace — zero cross-tenant data leakage across all tenant-owned collections.
- **SC-004**: Message traces are invisible to owner users and visible only to admins.
- **SC-005**: The one-agent-per-workspace constraint is enforced — creating a second agent for a workspace fails with a clear error.
- **SC-006**: The one-session-per-workspace constraint is enforced — creating a second WhatsApp session for a workspace fails with a clear error.
- **SC-007**: Deleting a knowledge file removes all associated chunks and vector rows within the same operation.
- **SC-008**: Deleting a workspace with dependent records is prevented with a clear error.
- **SC-009**: The dev seed script successfully creates a complete workspace environment in under 30 seconds.
- **SC-010**: After completing this spec, the application still passes `pnpm typecheck`, `pnpm lint`, and `pnpm build` with zero errors.

---

## Assumptions

- Phase 1 foundation is complete, verified, and stable — all existing code, config, and collections remain unchanged except where explicitly extended by this spec (e.g., `workspaces` collection gets new fields).
- The Payload multi-tenant plugin manages the tenants array on `users`; this spec does not modify that mechanism.
- Collections in this spec follow the Payload ownership rules (Article VII): all collection configs live in `src/payload/collections/`, all access control in `src/payload/access/`, and all hooks in `src/payload/hooks/`.
- The `knowledge_files` collection uses Payload's upload functionality with the already-configured `@payloadcms/storage-s3` adapter; physical file storage is handled by Payload automatically.
- Vector embedding dimensions are not fixed by this spec — the migration creates the `knowledge_vectors` table with a vector column whose dimension will match `text-embedding-3-small` output (1536 dimensions) as specified in the master plan.
- The retention cleanup mechanism in this spec is scaffolding only — the actual scheduled execution (QStash cron) belongs to a later phase.
- Invariants (one-agent, one-session, one-owner per workspace) are enforced via hooks, unique constraints, or validation logic — the specific technical mechanism is an implementation decision.
- No UI pages or customer-facing features are created in this spec. All verification is through the Payload Admin panel, direct database inspection, or seed scripts.
- Cascade behavior (file delete → chunk delete → vector delete) may use hooks, database-level cascades, or a combination — the spec requires the outcome, not the mechanism.
- The `messages` collection stores `message_type` (e.g., `text`, `image`, `audio`) to support future unsupported-type detection, even though only text is processed in v1.
