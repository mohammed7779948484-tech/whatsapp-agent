# Implementation Plan: Database Setup

**Branch**: `002-database-setup` | **Date**: 2026-04-04 | **Spec**: [spec.md](file:///c:/Users/M/Desktop/AIagents/specs/002-database-setup/spec.md)
**Input**: Feature specification from `/specs/002-database-setup/spec.md`

## Summary

Create all tenant-owned Payload collections required by the WhatsApp AI SaaS platform, establish the pgvector SQL table for embedding storage, implement workspace-scoped access control across all collections, enforce critical v1 invariants (one-agent, one-session, one-owner per workspace), add lifecycle hooks for cascade deletion and safety guards, and provide development seed data.

This phase builds the complete data layer on top of the foundation established in Phase 1 (`001-project-foundation`). No customer-facing UI or features are created — all verification is through the Payload Admin panel and scripts.

## Technical Context

**Language/Version**: TypeScript strict mode (Next.js 16.2.x, Node.js 20.9+)
**Primary Dependencies**: Payload CMS 3.79.1, `@payloadcms/db-postgres`, `@payloadcms/storage-s3`, `@payloadcms/plugin-multi-tenant`
**Storage**: Neon PostgreSQL with pgvector, Cloudflare R2
**Testing**: Vitest (unit/integration), Playwright (e2e)
**Target Platform**: Vercel (serverless)
**Project Type**: Web service (Next.js + Payload monolith)
**Performance Goals**: Not applicable for data model phase — no user-facing latency targets
**Constraints**: All collections must be tenant-scoped, `overrideAccess: false` on user-facing operations
**Scale/Scope**: 8 new collections, 1 SQL table, ~12 access control functions, ~5 hooks, 1 migration, 1 seed script

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Article | Status | Notes |
|------|---------|--------|-------|
| Collections in `src/payload/collections/` | VII | ✅ PASS | All new collections placed in `src/payload/collections/` |
| Access control in `src/payload/access/` | VII | ✅ PASS | New access functions in `src/payload/access/` |
| Hooks in `src/payload/hooks/` | VII | ✅ PASS | New hooks in `src/payload/hooks/` |
| No feature-level schema | VII | ✅ PASS | No collections defined in `src/features/` |
| Tenant isolation via multi-tenant plugin + access control | IV | ✅ PASS | Workspace-scoped access on all tenant-owned collections |
| `overrideAccess: false` on user-facing operations | IV | ✅ PASS | Enforced in access control pattern |
| Imports flow downward only | VI | ✅ PASS | Collections import from `core/`, `shared/` only. No upward imports. |
| No `any` types | Stack | ✅ PASS | Strict TypeScript enforced |
| File naming: `[purpose].[type].ts` | Naming | ✅ PASS | `agents.collection.ts`, `workspace-scope.access.ts`, etc. |
| Multi-tenant plugin with `tenantsSlug: 'workspaces'` | IV | ✅ PASS | Unchanged from Phase 1 config |
| One owner, one workspace, one agent, one session | I, IV | ✅ PASS | Invariants enforced by hooks |
| Kebab-case folders | Naming | ✅ PASS | All folders use kebab-case |

**Post-design re-check**: All gates still pass. No violations found after design phase.

## Project Structure

### Documentation (this feature)

```text
specs/002-database-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── payload/
│   ├── collections/
│   │   ├── index.ts                        # MODIFY — add new collection exports
│   │   ├── users.collection.ts             # EXISTING — no changes
│   │   ├── workspaces.collection.ts        # MODIFY — add owner + last_knowledge_update_at fields
│   │   ├── agents.collection.ts            # NEW
│   │   ├── whatsapp-sessions.collection.ts # NEW
│   │   ├── knowledge-files.collection.ts   # NEW (upload-enabled)
│   │   ├── knowledge-chunks.collection.ts  # NEW
│   │   ├── conversations.collection.ts     # NEW
│   │   ├── messages.collection.ts          # NEW
│   │   ├── message-traces.collection.ts    # NEW
│   │   └── ingestion-jobs.collection.ts    # NEW
│   ├── access/
│   │   ├── index.ts                        # MODIFY — add new access exports
│   │   ├── is-admin.access.ts              # EXISTING
│   │   ├── is-owner.access.ts              # EXISTING
│   │   ├── is-admin-or-self.access.ts      # EXISTING
│   │   ├── can-read-own-workspace.access.ts # EXISTING
│   │   ├── workspace-scope.access.ts       # NEW — tenant-scoped read/write
│   │   ├── workspace-owner-crud.access.ts  # NEW — owner CRUD within own workspace
│   │   └── traces-admin-only.access.ts     # NEW — admin-only read for traces
│   ├── hooks/
│   │   ├── enforce-one-per-workspace.hook.ts        # NEW — reusable uniqueness enforcer
│   │   ├── knowledge-file-after-delete.hook.ts      # NEW — cascade chunks + vectors
│   │   ├── knowledge-file-before-change.hook.ts     # NEW — init ingestion metadata
│   │   ├── workspace-before-delete.hook.ts          # NEW — guard against dependent data
│   │   └── message-trace-before-read.hook.ts        # NEW — admin filter (or handled via access)
│   ├── migrations/
│   │   ├── 00001_enable_pgvector.ts                 # EXISTING
│   │   └── 00002_create_knowledge_vectors.ts        # NEW
│   ├── payload.config.ts                            # MODIFY — register new collections, update s3Storage
│   └── lib/
│       ├── get-payload.ts                           # EXISTING
│       ├── with-tenant-context.ts                   # EXISTING
│       └── index.ts                                 # EXISTING
├── shared/
│   └── types/
│       └── workspace-status.ts                      # EXISTING — no changes
scripts/
│   ├── seed-admin.mjs                               # EXISTING — no changes
│   └── seed-dev.mjs                                 # NEW — development environment seeder
```

**Structure Decision**: All new files follow the established Phase 1 structure. No new directories are introduced outside existing convention. The `src/payload/hooks/` directory was listed in the master plan tree but was not created in Phase 1 — it will be created as part of this phase.

## Complexity Tracking

No constitution violations requiring justification. All design decisions align with established rules.

## Design Decisions Summary

Full rationale documented in [research.md](file:///c:/Users/M/Desktop/AIagents/specs/002-database-setup/research.md).

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Tenant field pattern | Explicit `workspace` relationship per collection | Matches Phase 1 pattern; plugin's `includeDefaultField: false` |
| Vector storage | SQL table via custom migration | Payload doesn't support vector columns natively |
| Invariant enforcement | `beforeChange` hooks | Idiomatic Payload pattern; user-friendly error messages |
| Upload collection | Payload upload + s3Storage registration | Master plan requirement; leverages existing R2 adapter |
| Cascade deletion | `afterDelete` hook (chunks via Local API + vectors via SQL) | SC-007 requires synchronous cleanup |
| Workspace deletion | Guard hook (reject if dependencies exist) | Safer than cascade for tenant root entity |
| Trace visibility | Access control function (not hook) | Query-level filtering is cleaner than post-query filtering |
| Dev seed | Separate `seed-dev.mjs` script | Keeps admin bootstrap separate from test data |
