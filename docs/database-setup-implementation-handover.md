# Database Setup Implementation Handover

## Overview

The `002-database-setup` specification implements the full tenant-owned Payload data layer for
the WhatsApp AI SaaS MVP. It adds the core collections, access control rules, hooks,
migrations, storage wiring, retention scaffolding, and development seed flows required by the
later WhatsApp, ingestion, and AI runtime phases.

This implementation now covers:

- tenant-owned records for agents, WhatsApp sessions, knowledge files, knowledge chunks,
  conversations, messages, message traces, and ingestion jobs
- workspace extension fields on `workspaces`
- tenant-scoped access control for owner/admin roles
- admin-only message trace visibility
- one-agent-per-workspace, one-session-per-workspace, and one-owner-per-workspace enforcement
- upload-backed knowledge files stored through Payload + `@payloadcms/storage-s3` + Cloudflare R2
- `knowledge_vectors` pgvector migration scaffolding
- development seed scripts and retention query scaffolding

## Scope of This Spec

Authoritative inputs reviewed:

- `specs/002-database-setup/spec.md`
- `specs/002-database-setup/tasks.md`
- `specs/002-database-setup/plan.md`
- `specs/002-database-setup/data-model.md`
- `specs/002-database-setup/research.md`
- `specs/002-database-setup/quickstart.md`
- `.specify/memory/constitution.md`
- `.specify/memory/standards/feature-template.md`
- `.specify/memory/standards/module-template.md`

This spec covers the database/data-model layer only. It does not implement the actual WAHA
runtime, ingestion execution pipeline, retrieval runtime, or new end-user product flows.

## Source Files Reviewed

Core files reviewed during the complete audit:

- `specs/002-database-setup/spec.md`
- `specs/002-database-setup/tasks.md`
- `specs/002-database-setup/plan.md`
- `specs/002-database-setup/data-model.md`
- `specs/002-database-setup/research.md`
- `specs/002-database-setup/quickstart.md`
- `src/payload/payload.config.ts`
- `src/payload/collections/index.ts`
- `src/payload/collections/users.collection.ts`
- `src/payload/collections/workspaces.collection.ts`
- `src/payload/collections/agents.collection.ts`
- `src/payload/collections/whatsapp-sessions.collection.ts`
- `src/payload/collections/knowledge-files.collection.ts`
- `src/payload/collections/knowledge-chunks.collection.ts`
- `src/payload/collections/conversations.collection.ts`
- `src/payload/collections/messages.collection.ts`
- `src/payload/collections/message-traces.collection.ts`
- `src/payload/collections/ingestion-jobs.collection.ts`
- `src/payload/access/index.ts`
- `src/payload/access/is-admin.access.ts`
- `src/payload/access/is-owner.access.ts`
- `src/payload/access/is-admin-or-self.access.ts`
- `src/payload/access/can-read-own-workspace.access.ts`
- `src/payload/access/workspace-scope.access.ts`
- `src/payload/access/workspace-owner-crud.access.ts`
- `src/payload/access/traces-admin-only.access.ts`
- `src/payload/hooks/enforce-one-per-workspace.hook.ts`
- `src/payload/hooks/enforce-one-owner-per-workspace.hook.ts`
- `src/payload/hooks/workspace-before-delete.hook.ts`
- `src/payload/hooks/knowledge-file-before-change.hook.ts`
- `src/payload/hooks/knowledge-file-after-delete.hook.ts`
- `src/payload/hooks/sync-workspace-from-relation.hook.ts`
- `src/payload/hooks/validate-message-trace-links.hook.ts`
- `src/payload/migrations/00001_enable_pgvector.ts`
- `src/payload/migrations/00002_create_knowledge_vectors.ts`
- `src/payload/lib/get-payload.ts`
- `src/payload/lib/index.ts`
- `src/payload/lib/retention-cleanup.ts`
- `src/payload/lib/with-tenant-context.ts`
- `src/core/auth/get-session.ts`
- `src/core/auth/get-owner-dashboard-session.ts`
- `src/core/auth/verify-workspace-session.ts`
- `src/core/errors/app-error.ts`
- `src/core/errors/error-codes.ts`
- `scripts/seed-admin.mjs`
- `scripts/seed-dev.mjs`
- `src/payload-types.ts`
- `tests/unit/payload/access.test.ts`
- `tests/integration/api/routes.test.ts`
- `tests/integration/proxy.test.ts`

## Phase-by-Phase Implementation Summary

### Phase 1 - Shared Setup

Implemented shared building blocks:

- `workspaceScope` for tenant-scoped reads
- `workspaceOwnerCrud` for owner-scoped CRUD
- `tracesAdminOnly` for admin-only traces
- `enforceOnePerWorkspace` reusable invariant hook
- `00002_create_knowledge_vectors.ts` migration file
- new error codes for duplicate resources and workspace safety

### Phase 2 - Foundational Collections

Implemented and wired:

- `workspaces` extension with `owner` and `last_knowledge_update_at`
- `agents`
- `whatsapp_sessions`
- `conversations`
- `messages`
- `message_traces`
- `ingestion_jobs`

### Phase 3 - Knowledge Collections and Lifecycle

Implemented:

- `knowledge_files` as an upload-enabled collection
- `knowledge_chunks`
- `knowledgeFileBeforeChange`
- `knowledgeFileAfterDelete`

### Phase 4 - Collection Registration and R2 Wiring

Implemented:

- barrel exports in `src/payload/collections/index.ts`
- collection registration in `src/payload/payload.config.ts`
- `knowledge_files` S3/R2 storage registration with prefix `knowledge`

### Phase 5 - Tenant Safety and Invariants

Implemented:

- `workspaceBeforeDelete`
- `enforceOneOwnerPerWorkspace`
- denormalized workspace synchronization hooks
- message trace relationship consistency validation

### Phase 6 - Vector Storage

Implemented:

- `knowledge_vectors` SQL migration with:
  - table creation
  - `workspace_id` index
  - `file_id` index
  - `chunk_id` index
  - HNSW cosine index for embeddings

### Phase 7 - Development Seed Script

Implemented:

- `scripts/seed-admin.mjs`
- `scripts/seed-dev.mjs`
- `seed:admin` and `seed:dev` commands in `package.json`

The dev seed creates:

- a development workspace
- an owner user bound to that workspace
- an agent
- a WhatsApp session placeholder
- a sample uploaded CSV knowledge file

### Phase 8 - Retention Scaffolding

Implemented:

- `src/payload/lib/retention-cleanup.ts`

This provides the query helper used by future cleanup jobs to identify stale records older than
the configured retention window.

### Phase 9 - Admin Verification

Verified through the completion flow:

- admin can see all required collections
- admin can create workspaces, owners, agents, and sessions
- duplicate agents are rejected
- duplicate sessions are rejected
- owner uniqueness is enforced

### Phase 10 - Conversation and Message Verification

Verified through the completion flow:

- conversations, inbound/outbound messages, and traces can be created correctly
- trace relations stay workspace-scoped
- owner users cannot access traces
- admin users can access traces

### Phase 11 - Polish and Cross-Cutting Validation

Validated for closure:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- seed flow review and quickstart closure

Spec/task closure state is now treated as complete:

- `specs/002-database-setup/spec.md` status updated to `Implemented`
- `specs/002-database-setup/tasks.md` closed through `T041`

## Task-to-Code Mapping Summary

| Task Group | Main Files |
|---|---|
| T001-T006 shared setup | `src/payload/access/*.ts`, `src/payload/hooks/enforce-one-per-workspace.hook.ts`, `src/payload/migrations/00002_create_knowledge_vectors.ts`, `src/core/errors/error-codes.ts` |
| T007-T013 foundational collections | `src/payload/collections/workspaces.collection.ts`, `src/payload/collections/agents.collection.ts`, `src/payload/collections/whatsapp-sessions.collection.ts`, `src/payload/collections/conversations.collection.ts`, `src/payload/collections/messages.collection.ts`, `src/payload/collections/message-traces.collection.ts`, `src/payload/collections/ingestion-jobs.collection.ts` |
| T014-T018 knowledge collections/hooks | `src/payload/collections/knowledge-files.collection.ts`, `src/payload/collections/knowledge-chunks.collection.ts`, `src/payload/hooks/knowledge-file-before-change.hook.ts`, `src/payload/hooks/knowledge-file-after-delete.hook.ts` |
| T019-T021 registration/storage | `src/payload/collections/index.ts`, `src/payload/payload.config.ts` |
| T022-T026 tenant safety | `src/payload/hooks/workspace-before-delete.hook.ts`, `src/payload/hooks/enforce-one-owner-per-workspace.hook.ts`, `src/payload/hooks/sync-workspace-from-relation.hook.ts`, `src/payload/hooks/validate-message-trace-links.hook.ts`, `src/payload/access/*.ts` |
| T027 vector migration | `src/payload/migrations/00002_create_knowledge_vectors.ts` |
| T028-T029 seed scripts | `scripts/seed-admin.mjs`, `scripts/seed-dev.mjs`, `package.json` |
| T030 retention | `src/payload/lib/retention-cleanup.ts`, `src/payload/lib/index.ts` |
| T031-T041 verification/closure | `src/payload-types.ts`, `tests/unit/payload/access.test.ts`, `specs/002-database-setup/tasks.md`, admin/manual verification |

## Current Project Structure Relevant to This Spec

Deep structure for all files created, extended, or directly relied on by Spec `002-database-setup`:

```text
docs/
└── database-setup-implementation-handover.md

specs/
└── 002-database-setup/
    ├── checklists/
    │   └── requirements.md
    ├── data-model.md
    ├── plan.md
    ├── quickstart.md
    ├── research.md
    ├── spec.md
    └── tasks.md

scripts/
├── seed-admin.mjs
└── seed-dev.mjs

tests/
├── integration/
│   ├── api/
│   │   └── routes.test.ts
│   └── proxy.test.ts
└── unit/
    ├── api/
    │   └── not-implemented.test.ts
    └── payload/
        └── access.test.ts

src/
├── app/
│   ├── providers.tsx
│   ├── (frontend)/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       └── dashboard/
│   │           └── page.tsx
│   ├── (payload)/
│   │   ├── layout.tsx
│   │   ├── admin/
│   │   │   ├── importMap.js
│   │   │   └── [[...segments]]/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   └── [...slug]/
│   │   │       └── route.ts
│   │   ├── graphql/
│   │   │   └── route.ts
│   │   └── graphql-playground/
│   │       └── route.ts
│   └── api/
│       ├── _lib/
│       │   └── not-implemented.ts
│       ├── health/
│       │   ├── route.ts
│       │   └── ready/
│       │       └── route.ts
│       ├── jobs/
│       │   ├── cleanup-retention/
│       │   │   └── route.ts
│       │   ├── delete-file-artifacts/
│       │   │   └── route.ts
│       │   ├── ingest-chunk/
│       │   │   └── route.ts
│       │   ├── ingest-embed/
│       │   │   └── route.ts
│       │   ├── ingest-parse/
│       │   │   └── route.ts
│       │   └── process-inbound-message/
│       │       └── route.ts
│       └── webhooks/
│           └── waha/
│               └── route.ts
├── core/
│   ├── auth/
│   │   ├── constants.ts
│   │   ├── dal.ts
│   │   ├── get-owner-dashboard-session.ts
│   │   ├── get-session.ts
│   │   ├── index.ts
│   │   ├── require-owner-session.ts
│   │   ├── session-cookie.ts
│   │   └── verify-workspace-session.ts
│   ├── env.ts
│   ├── errors/
│   │   ├── app-error.ts
│   │   ├── error-codes.ts
│   │   └── index.ts
│   └── logger/
│       ├── index.ts
│       └── logger.ts
├── payload/
│   ├── access/
│   │   ├── can-read-own-workspace.access.ts
│   │   ├── index.ts
│   │   ├── is-admin-or-self.access.ts
│   │   ├── is-admin.access.ts
│   │   ├── is-owner.access.ts
│   │   ├── traces-admin-only.access.ts
│   │   ├── workspace-owner-crud.access.ts
│   │   └── workspace-scope.access.ts
│   ├── collections/
│   │   ├── agents.collection.ts
│   │   ├── conversations.collection.ts
│   │   ├── index.ts
│   │   ├── ingestion-jobs.collection.ts
│   │   ├── knowledge-chunks.collection.ts
│   │   ├── knowledge-files.collection.ts
│   │   ├── message-traces.collection.ts
│   │   ├── messages.collection.ts
│   │   ├── users.collection.ts
│   │   ├── whatsapp-sessions.collection.ts
│   │   └── workspaces.collection.ts
│   ├── hooks/
│   │   ├── enforce-one-owner-per-workspace.hook.ts
│   │   ├── enforce-one-per-workspace.hook.ts
│   │   ├── knowledge-file-after-delete.hook.ts
│   │   ├── knowledge-file-before-change.hook.ts
│   │   ├── sync-workspace-from-relation.hook.ts
│   │   ├── validate-message-trace-links.hook.ts
│   │   └── workspace-before-delete.hook.ts
│   ├── lib/
│   │   ├── get-payload.ts
│   │   ├── index.ts
│   │   ├── retention-cleanup.ts
│   │   └── with-tenant-context.ts
│   ├── migrations/
│   │   ├── 00001_enable_pgvector.ts
│   │   └── 00002_create_knowledge_vectors.ts
│   └── payload.config.ts
├── shared/
│   └── types/
│       └── workspace-status.ts
└── payload-types.ts
```

## Collections / Schema / Data Model Involved

### `workspaces`

Extended tenant root entity:

- existing: `name`, `slug`, `status`
- added: `owner`, `last_knowledge_update_at`

### `agents`

One configurable assistant per workspace.

Fields:

- `workspace`
- `display_name`
- `response_style`
- `system_prompt`
- `quick_instructions`
- `language_preference`
- `is_enabled`

### `whatsapp_sessions`

One WAHA session metadata record per workspace.

Fields:

- `workspace`
- `session_name`
- `provider_status`
- `qr_code`
- `connected_phone`
- `last_synced_at`
- `last_error`

### `knowledge_files`

Upload-enabled Payload collection.

Payload-managed upload metadata:

- `filename`
- `mimeType`
- `filesize`
- `url`
- `prefix`

Feature-managed fields:

- `workspace`
- `parse_status`
- `ingestion_status`
- `ingestion_error`
- `uploaded_at`
- `parsed_at`
- `indexed_at`

### `knowledge_chunks`

Chunk records linked to a knowledge file.

- `workspace`
- `file`
- `chunk_index`
- `content`
- `content_hash`
- `metadata_json`

### `conversations`

Conversation/session thread per workspace.

- `workspace`
- `remote_jid`
- `session_started_at`
- `last_message_at`
- `status`

### `messages`

Inbound/outbound message records.

- `workspace`
- `conversation`
- `direction`
- `provider_message_id`
- `text`
- `message_type`
- `delivery_status`

Important behavior:

- `text` is required only for `message_type === 'text'`
- `workspace` is synchronized from the related conversation

### `message_traces`

Admin-only AI debug records.

- `workspace`
- `conversation`
- `inbound_message`
- `outbound_message`
- `prompt_snapshot`
- `retrieved_chunks_snapshot`
- `model_name`
- `used_fallback`
- `fallback_reason`
- `send_status`
- `error_details`

Important behavior:

- trace relationships are validated against workspace and conversation consistency

### `ingestion_jobs`

Async processing state for ingestion.

- `workspace`
- `file`
- `stage`
- `attempt_count`
- `last_error`
- `started_at`
- `finished_at`

Important behavior:

- `workspace` is synchronized from the related file

### `knowledge_vectors`

SQL table outside Payload collections.

- `id`
- `workspace_id`
- `file_id`
- `chunk_id`
- `embedding`
- `created_at`

## Routes / Actions / Services / Jobs Involved

This spec does not add major new customer-facing product routes, but it finalizes the data layer
used by admin, dashboard, and future job/webhook routes.

Relevant surfaces:

- Payload admin page:
  - `src/app/(payload)/admin/[[...segments]]/page.tsx`
- Payload admin layout:
  - `src/app/(payload)/layout.tsx`
- frontend root/layout surfaces:
  - `src/app/(frontend)/layout.tsx`
  - `src/app/(frontend)/(dashboard)/layout.tsx`
  - `src/app/(frontend)/(dashboard)/dashboard/page.tsx`
  - `src/app/(frontend)/(auth)/login/page.tsx`
- auth/session helpers used by dashboard and API:
  - `src/core/auth/get-session.ts`
  - `src/core/auth/get-owner-dashboard-session.ts`
  - `src/core/auth/verify-workspace-session.ts`
- future job/webhook consumers of this data model:
  - `/api/jobs/cleanup-retention`
  - `/api/jobs/delete-file-artifacts`
  - `/api/jobs/ingest-chunk`
  - `/api/jobs/ingest-embed`
  - `/api/jobs/ingest-parse`
  - `/api/jobs/process-inbound-message`
  - `/api/webhooks/waha`

## Core Business Logic and Control Flow

### Workspace Resolution

`resolveUserWorkspaceId` in `src/payload/access/workspace-scope.access.ts` is the central helper.
It resolves the owner workspace from:

- `user.tenant`
- `user.tenants[0].tenant`

This helper is reused across:

- `workspaceScope`
- `workspaceOwnerCrud`
- `canReadOwnWorkspace`
- `verifyWorkspaceSession`
- `withTenantContext`

### Tenant-Scoped Reads and Writes

- admins get unrestricted access where required
- owners are scoped by workspace filters
- `workspaceOwnerCrud` supports owner list/read/update/delete within the owner workspace
- `withTenantContext` forces `overrideAccess: false` for user-facing scoped queries

### One-Per-Workspace Invariants

`enforceOnePerWorkspace` enforces:

- creation-time uniqueness
- update-time uniqueness when a record is moved to a different workspace

Collections using it:

- `agents`
- `whatsapp_sessions`

### Workspace Synchronization From Parent Relations

`syncWorkspaceFromRelation` keeps denormalized workspace fields correct by deriving them from the
parent relation instead of trusting input.

Used by:

- `knowledge_chunks` from `file`
- `messages` from `conversation`
- `ingestion_jobs` from `file`

### Message Trace Consistency

`validateMessageTraceLinks` ensures:

- trace conversation and linked messages belong to the same workspace
- inbound/outbound messages belong to the same conversation
- workspace on the trace is derived from the validated conversation/messages

### Workspace Owner Invariant

`enforceOneOwnerPerWorkspace` now enforces:

- the selected owner must have role `owner`
- the selected owner must already belong to that same workspace
- the selected owner cannot already own another workspace

### Knowledge File Lifecycle

On create:

- `knowledgeFileBeforeChange` initializes `uploaded_at`, `parse_status`, and `ingestion_status`

On delete:

- `knowledgeFileAfterDelete` removes related `knowledge_chunks`
- then removes related `knowledge_vectors` rows
- then logs the cleanup

### Workspace Deletion Safety

`workspaceBeforeDelete` blocks deletion when any tenant-owned dependent data exists, including:

- agents
- whatsapp sessions
- knowledge files
- conversations
- messages
- traces
- knowledge chunks
- ingestion jobs
- vector rows

## Auth / Tenant / Security Rules Implemented

- tenant isolation is enforced through the Payload multi-tenant user assignment plus strict
  access-control filters
- owners are limited to a single assigned workspace
- owners can only read/write their own workspace data where allowed
- admins retain management authority through Payload Admin
- message traces are admin-only via `tracesAdminOnly`
- relationship synchronization hooks prevent cross-workspace mismatches that could otherwise leak
  data to owners
- `proxy.ts` and auth flows prevent owner users from using the admin panel routes

## External Integrations Involved

- `@payloadcms/db-postgres` for PostgreSQL/Neon
- `pgvector` via SQL migration
- `@payloadcms/storage-s3` for object storage integration
- Cloudflare R2 as the S3-compatible storage backend
- `@payloadcms/plugin-multi-tenant` for workspace assignment and tenant modeling

Deferred-but-related integrations still outside this spec:

- WAHA provisioning/runtime
- ingestion execution workers
- retrieval/vector similarity services
- QStash-orchestrated job execution

## Tests and Validation Performed

Validated during the final audit:

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅
- `pnpm build` ✅

Added focused unit coverage in:

- `tests/unit/payload/access.test.ts`

This test file covers:

- workspace resolution from plugin-managed tenant fields
- owner read filtering in `workspaceOwnerCrud`
- conditional `messages.text` validation based on `message_type`

Manual/admin verification reported completed for:

- collection visibility in Payload Admin
- workspace/owner/agent/session creation flow
- duplicate agent rejection
- duplicate session rejection
- owner uniqueness rejection
- conversation/message/trace linking
- admin-only trace visibility
- successful `knowledge_files` upload

## Issues Found and Fixed During Audit

The audit fixed the following real implementation issues:

1. **Workspace resolution inconsistency**
   - centralized on `resolveUserWorkspaceId`
   - reused across auth/access/query helpers

2. **Owner list/read access bug**
   - fixed `workspaceOwnerCrud` so owner list reads return a workspace filter instead of `false`

3. **Admin seed script access failure**
   - updated `scripts/seed-admin.mjs` to use `overrideAccess: true`
   - normalized exit behavior for script execution

4. **Dev seed bypassed real upload behavior**
   - replaced raw SQL file creation with real Payload upload-backed creation

5. **One-per-workspace update bypass**
   - fixed `enforceOnePerWorkspace` to validate workspace-changing updates

6. **Invalid denormalized workspace writes**
   - added `syncWorkspaceFromRelation` for messages, chunks, and ingestion jobs

7. **Incomplete trace relationship validation**
   - added `validateMessageTraceLinks`

8. **Workspace owner consistency gap**
   - owner must now be an owner-role user assigned to the same workspace

9. **Workspace delete guard coverage gap**
   - extended guard coverage to all related collections and vector rows

10. **Message text validation too strict**
    - `messages.text` is now required only for text messages

11. **Script command consistency**
    - aligned `seed:admin` and `seed:dev` command patterns

12. **Verification coverage improvement**
    - added focused Payload unit tests for access/validation behavior

## Remaining Limitations or Deferred Items

- `knowledge_vectors` still has no DB-level foreign keys or cascading deletes
- knowledge-file cleanup is still hook-driven sequential cleanup, not one DB transaction
- later runtime phases still need to implement actual WAHA processing, ingestion orchestration,
  retrieval, and scheduled retention execution
- this spec intentionally stops at the data layer and verification/seed boundaries

## Final Implementation Status

Status: **IMPLEMENTATION VERIFIED**

Reasoning:

- the implemented code matches the intended feature scope and task checklist through Phase 11
- all major code-level issues found during the audit were fixed
- validation commands pass in the repository
- the spec has been reviewed, documented, and closed with a complete technical handover
