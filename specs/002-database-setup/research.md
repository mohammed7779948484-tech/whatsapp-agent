# Research: Database Setup

**Branch**: `002-database-setup` | **Date**: 2026-04-04
**Input**: spec.md technical unknowns and dependency analysis

## Research Summary

No critical technical unknowns were found during the specification and clarification phases. All technology choices are locked by the constitution (v1.2.0) and master implementation plan. This research document records the resolved decisions and rationale for traceability.

---

## Decision 1: Payload Collection Definition Pattern for Tenant-Owned Collections

**Decision**: All new tenant-owned collections use the standard Payload `CollectionConfig` pattern with explicit `workspace` relationship fields and workspace-scoped access control functions.

**Rationale**: The constitution (Article VII) mandates all collection configs live in `src/payload/collections/`. The multi-tenant plugin is configured with `tenantsSlug: 'workspaces'` but the plugin's automatic tenant field injection is bypassed (`includeDefaultField: false` in Phase 1 config). Each collection must explicitly define its own `workspace` relation field and use access control functions that check workspace ownership.

**Alternatives considered**:
- Plugin-managed automatic tenant fields → Rejected because Phase 1 established `includeDefaultField: false` and manual workspace relation is already the pattern.

---

## Decision 2: Vector Table Management Strategy

**Decision**: The `knowledge_vectors` table is created and managed via a custom Payload migration file in `src/payload/migrations/`, using raw SQL. The table is NOT a Payload collection — it is a direct SQL table for pgvector operations.

**Rationale**: Payload collections do not natively support vector column types. The master plan explicitly designates `knowledge_vectors` as a "SQL table outside Payload collections." A dedicated SQL helper in `src/modules/knowledge/lib/knowledge-vectors.ts` will handle all vector insert/query operations (built in Phase 4).

**Alternatives considered**:
- Storing vectors as JSON in a Payload collection → Rejected because it loses pgvector indexing and similarity search capabilities.
- Using a separate vector database (Pinecone, Qdrant) → Rejected by master plan; pgvector in Neon is the locked choice.

---

## Decision 3: One-Per-Workspace Invariant Enforcement Mechanism

**Decision**: Use Payload `beforeChange` collection hooks to enforce one-agent-per-workspace and one-session-per-workspace invariants. The hook queries for existing records in the same workspace before allowing creation.

**Rationale**: Payload does not support multi-column unique constraints natively through collection config. A `beforeChange` hook on the `create` operation is the idiomatic Payload pattern for business rule enforcement. Database-level unique constraints (on workspace + collection) can be added as defense-in-depth via migration.

**Alternatives considered**:
- Database unique constraint only → Insufficient alone because the error message from a raw DB constraint violation is not user-friendly in the Admin panel.
- Validation function on workspace field → Payload field-level validators don't have access to check other records in the collection during validation.

---

## Decision 4: Knowledge File Upload-Enabled Collection Pattern

**Decision**: The `knowledge_files` collection uses Payload's built-in `upload` configuration to enable file handling. The `@payloadcms/storage-s3` adapter (already configured in Phase 1) automatically routes uploads to Cloudflare R2.

**Rationale**: Master plan specifies "Payload upload-enabled `knowledge_files` collection backed by `@payloadcms/storage-s3`." This means using `upload: { staticDir: ... }` or equivalent in the collection config and registering `knowledge_files` in the `s3Storage` plugin's `collections` map (currently empty `{}` from Phase 1).

**Alternatives considered**:
- Custom file upload handling outside Payload → Rejected; violates Payload ownership rules and loses R2 adapter integration.

---

## Decision 5: Cascade Deletion Strategy for Knowledge Files

**Decision**: Use a Payload `afterDelete` hook on `knowledge_files` to cascade delete associated `knowledge_chunks` (via Payload Local API) and `knowledge_vectors` rows (via raw SQL through the database adapter). Both deletions happen within the hook execution context.

**Rationale**: FR-018 and SC-007 in the spec require atomic-style cleanup. Payload hooks execute within the request lifecycle and can perform multiple operations. The vector table is outside Payload, so raw SQL deletion scoped by `file_id` is necessary.

**Alternatives considered**:
- Database-level foreign key cascades → Partially viable for chunks (if Payload supports FK constraints), but vectors are in a separate SQL table not managed by Payload's ORM, so a hook is required for vectors regardless.
- Deferred async cleanup via QStash → Rejected for Phase 2 because the spec requires synchronous cascade ("within the same operation").

---

## Decision 6: Workspace Deletion Guard

**Decision**: Use a `beforeDelete` hook on `workspaces` that checks for dependent records (agents, sessions, files, conversations, etc.) and throws an `AppError` to block deletion if dependencies exist.

**Rationale**: FR-020 requires preventing workspace deletion when dependent records exist. A guard hook is simpler and safer than complex cascade deletion of an entire tenant's data. In v1, workspace deletion is an admin-only operation and should require manual cleanup of dependencies first.

**Alternatives considered**:
- Full cascade deletion of all tenant data → Too dangerous for v1; accidental workspace deletion would be catastrophic and unrecoverable.
- Soft delete (flag-based) → Constitution does not require soft deletes; hard guard is safer.

---

## Decision 7: Message Traces Admin-Only Visibility

**Decision**: Use a Payload access control function (not a hook) on the `message_traces` collection that restricts all read operations to admin users only. Owners receive empty results.

**Rationale**: FR-015 and FR-021 both require admin-only trace visibility. An access control function is the cleanest mechanism because it works at the query level, preventing any trace data from being returned to non-admin users without needing to filter results post-query.

**Alternatives considered**:
- beforeRead hook that filters results → Access control functions are more appropriate; hooks are for side effects, access functions are for authorization.

---

## Decision 8: Dev Seed Script Approach

**Decision**: Extend the existing `scripts/seed-admin.mjs` pattern to add a `scripts/seed-dev.mjs` (or equivalent) that creates a complete workspace environment after admin seeding.

**Rationale**: Phase 1 established `scripts/seed-admin.mjs` for creating the first admin user. The dev seed script follows the same pattern and can be invoked via a new npm script (`pnpm seed:dev`). Idempotency is achieved by checking for existing records before creating.

**Alternatives considered**:
- Single combined seed script → Rejected to keep admin bootstrap separate from development test data.
