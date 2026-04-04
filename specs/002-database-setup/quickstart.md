# Quickstart: Database Setup

**Branch**: `002-database-setup` | **Date**: 2026-04-04

## Prerequisites

- Phase 1 (`001-project-foundation`) fully complete and verified
- Application boots locally with `pnpm dev`
- Admin user exists (created via `pnpm seed:admin`)
- Neon PostgreSQL connected with pgvector extension enabled
- Cloudflare R2 storage configured

## Setup Steps

### 1. Install any new dependencies (if needed)

```bash
pnpm install
```

No new npm dependencies are expected for this phase — all required packages were installed in Phase 1.

### 2. Generate Payload types after adding collections

After implementing the new collections, regenerate the Payload type definitions:

```bash
pnpm payload generate:types
```

### 3. Run database migrations

Apply the new migration that creates the `knowledge_vectors` SQL table:

```bash
pnpm payload migrate
```

### 4. Seed development data

After the admin seed from Phase 1, run the dev seed script to populate a representative workspace environment:

```bash
pnpm seed:dev
```

This creates:
- A sample workspace with an assigned owner
- An agent for that workspace
- A WhatsApp session placeholder
- A sample knowledge file record

### 5. Verify collections in Admin panel

1. Start the dev server: `pnpm dev`
2. Open `http://localhost:3000/admin`
3. Log in as admin
4. Verify all new collections appear in the admin sidebar:
   - Agents
   - WhatsApp Sessions
   - Knowledge Files
   - Knowledge Chunks
   - Conversations
   - Messages
   - Message Traces
   - Ingestion Jobs

### 6. Verify tenant isolation

1. Log in as the owner user created by the seed script
2. Navigate to the customer dashboard
3. Confirm the owner can see only their workspace's data
4. Confirm the owner cannot access message traces

### 7. Verify invariants

In the admin panel:
1. Attempt to create a second agent for the same workspace → should be rejected
2. Attempt to create a second WhatsApp session for the same workspace → should be rejected

### 8. Verify cascade deletion

In the admin panel:
1. Create a knowledge file record with associated chunks
2. Delete the knowledge file
3. Verify all associated chunks are removed
4. Verify associated vector rows are removed (check via SQL if needed)

### 9. Verify the vector table

```sql
SELECT * FROM pg_tables WHERE tablename = 'knowledge_vectors';
SELECT indexname FROM pg_indexes WHERE tablename = 'knowledge_vectors';
```

Expected: Table exists with HNSW index on embedding column and B-tree indexes on workspace_id, file_id, chunk_id.

### 10. Run validation suite

```bash
pnpm typecheck
pnpm lint
pnpm build
```

All must pass with zero errors.

## Verification Checklist

- [ ] All 8 new collections visible in Admin panel
- [ ] Workspaces collection has new `owner` and `last_knowledge_update_at` fields
- [ ] `knowledge_vectors` SQL table exists with correct indexes
- [ ] Tenant isolation verified — owner sees only own workspace data
- [ ] Message traces invisible to owner users
- [ ] One-agent-per-workspace invariant enforced
- [ ] One-session-per-workspace invariant enforced
- [ ] Knowledge file cascade deletion works (chunks + vectors removed)
- [ ] Workspace deletion blocked when dependencies exist
- [ ] Dev seed script runs successfully and is idempotent
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
