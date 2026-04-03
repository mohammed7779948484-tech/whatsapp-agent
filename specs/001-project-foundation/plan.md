# Implementation Plan: Project Foundation

**Branch**: `001-project-foundation` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-foundation/spec.md`

## Summary

Establish the baseline project infrastructure: initialize a Next.js 16.2.x + Payload CMS 3.79.1 single-codebase application with TypeScript strict mode, connect Neon PostgreSQL with pgvector enabled, configure Cloudflare R2 file storage via `@payloadcms/storage-s3`, install the Payload multi-tenant plugin with `tenantsSlug: 'workspaces'`, implement environment validation (fail-fast), set up built-in auth with 24-hour session expiry, scaffold health/readiness endpoints and job route placeholders, configure linting/testing/type-checking baselines, and commit governance documents (constitution, feature template, module template).

## Technical Context

**Language/Version**: TypeScript strict mode on Node.js 20.9+ or 22 LTS
**Primary Dependencies**: Next.js 16.2.x, React 19.2.x, Payload CMS 3.79.1 (pinned), `@payloadcms/plugin-multi-tenant`, `@payloadcms/storage-s3`, `@payloadcms/db-postgres`
**Storage**: Neon PostgreSQL with pgvector extension; Cloudflare R2 for file storage (S3-compatible)
**Testing**: Vitest for unit/integration tests, Playwright for e2e, ESLint for linting
**Target Platform**: Vercel (production), localhost (development)
**Project Type**: Web service (SaaS — single Next.js + Payload codebase)
**Performance Goals**: Application boot < 30 seconds, health endpoint response < 1 second, env validation failure < 5 seconds
**Constraints**: No `any` types permitted, no billing/subscription logic, invite-only (no public signup), serverless-first
**Scale/Scope**: Single-tenant-per-workspace, < 100 workspaces for initial launch, one admin user, one owner per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | MVP scope discipline — no features outside approved scope | ✅ PASS | Foundation only: boot, auth, DB, storage, env validation, health, governance. No additional features. |
| 2 | Invite-only — no public signup | ✅ PASS | Accounts created via admin panel only (FR-004). No signup page in scope. |
| 3 | One owner, one workspace, one agent | ✅ PASS | Multi-tenant plugin constrained to one workspace per owner. Agent and WhatsApp session are Phase 2+. |
| 4 | Tenant isolation via multi-tenant plugin | ✅ PASS | Plugin installed with `tenantsSlug: 'workspaces'` (FR-011). |
| 5 | `overrideAccess: false` on sensitive ops | ✅ PASS | Will be enforced in `with-tenant-context.ts` helper and access rules. |
| 6 | Payload Admin for admin only | ✅ PASS | FR-019: customer owners denied admin panel access. |
| 7 | TypeScript strict, no `any` | ✅ PASS | FR-017: strict type checking, no permissive escape hatches. |
| 8 | Architecture layering respected | ✅ PASS | Source code structure follows constitution Article VI exactly. |
| 9 | Serverless-first runtime | ✅ PASS | Single Next.js + Payload on Vercel. No blocking long-running work in foundation. |
| 10 | No billing/subscription logic | ✅ PASS | Workspace status defaults to `active` (FR-020). No billing language anywhere. |
| 11 | `proxy.ts` at root (not middleware.ts) | ✅ PASS | Root structure includes `proxy.ts` per constitution Article VI. |
| 12 | Naming conventions (kebab-case folders, PascalCase components) | ✅ PASS | All source paths follow kebab-case convention. |

**Gate result**: ALL GATES PASS ✅ — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-foundation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── health-api.md    # Health/readiness endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                              # Root layout
│   ├── (payload)/
│   │   └── admin/
│   │       └── [[...segments]]/
│   │           └── page.tsx                    # Payload Admin entry
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                        # Customer login page
│   ├── (dashboard)/
│   │   ├── layout.tsx                          # Protected dashboard layout (skeleton)
│   │   └── dashboard/
│   │       └── page.tsx                        # Dashboard placeholder
│   ├── api/
│   │   ├── health/
│   │   │   ├── route.ts                        # Liveness endpoint
│   │   │   └── ready/
│   │   │       └── route.ts                    # Readiness endpoint
│   │   ├── webhooks/
│   │   │   └── waha/
│   │   │       └── route.ts                    # WAHA webhook placeholder (501)
│   │   └── jobs/
│   │       ├── ingest-parse/
│   │       │   └── route.ts                    # Scaffold placeholder
│   │       ├── ingest-chunk/
│   │       │   └── route.ts                    # Scaffold placeholder
│   │       ├── ingest-embed/
│   │       │   └── route.ts                    # Scaffold placeholder
│   │       ├── delete-file-artifacts/
│   │       │   └── route.ts                    # Scaffold placeholder
│   │       ├── cleanup-retention/
│   │       │   └── route.ts                    # Scaffold placeholder
│   │       └── process-inbound-message/
│   │           └── route.ts                    # Scaffold placeholder
│   └── providers.tsx                           # Client providers wrapper
├── features/
│   └── _registry/
│       ├── index.ts                            # Feature registry barrel
│       └── types.ts                            # Feature config types
├── modules/                                     # Empty — populated Phase 2+
├── widgets/                                     # Empty — populated Phase 6
├── payload/
│   ├── payload.config.ts                        # Payload configuration
│   ├── lib/
│   │   ├── get-payload.ts                       # Singleton Payload accessor
│   │   └── with-tenant-context.ts               # Tenant-scoped operation helper
│   ├── access/
│   │   ├── is-admin.access.ts                   # Admin role check
│   │   └── is-owner.access.ts                   # Owner role check
│   ├── collections/
│   │   ├── index.ts                             # Collection barrel export
│   │   ├── users.collection.ts                  # Users collection
│   │   └── workspaces.collection.ts             # Workspaces (tenant boundary) collection
│   ├── admin/                                   # Empty — populated Phase 2+
│   ├── globals/                                 # Empty — populated later
│   ├── hooks/                                   # Empty — populated Phase 2+
│   └── migrations/                              # Payload auto-generated migrations
├── core/
│   ├── env.ts                                   # Environment validation (fail-fast)
│   ├── auth/
│   │   ├── dal.ts                               # Data access layer for auth
│   │   ├── get-session.ts                       # Session retrieval helper
│   │   ├── require-owner-session.ts             # Owner session guard
│   │   ├── session-cookie.ts                    # Cookie configuration
│   │   └── verify-workspace-session.ts          # Workspace session verifier
│   ├── errors/
│   │   ├── app-error.ts                         # AppError class
│   │   └── error-codes.ts                       # Error code constants
│   ├── logger/
│   │   ├── index.ts                             # Logger barrel
│   │   └── logger.ts                            # Structured logger
│   └── providers/                               # Empty — populated Phase 3+
├── shared/
│   ├── lib/
│   │   ├── invariant.ts                         # Runtime assertion helper
│   │   └── safe-json.ts                         # Safe JSON parse utility
│   ├── types/
│   │   ├── action-result.ts                     # Server Action result type
│   │   └── workspace-status.ts                  # Workspace status enum
│   └── ui/                                      # Empty — populated Phase 6
└── payload-types.ts                             # Auto-generated Payload types

tests/
├── e2e/                                         # Empty — populated Phase 7
├── integration/
│   └── payload/                                 # Empty — integration tests populated Phase 2
└── unit/
    └── shared/                                  # Empty — populated as needed

# Root files
.env.example
.gitignore
components.json
eslint.config.mjs
next.config.ts
package.json
playwright.config.ts
postcss.config.mjs
README.md
tsconfig.json
vitest.config.ts
proxy.ts
```

**Structure Decision**: Single-codebase web service following the constitution Article VI layering. All layers are created with placeholders/barrels even if empty, ensuring Phase 2+ doesn't need structural changes.

## Complexity Tracking

No complexity violations detected. All choices follow the simplest constitutional path.

## Key Technical Decisions

### 1. Environment Validation Strategy

Environment validation uses a typed schema checked at import time during application boot. Each required variable is validated for presence and format (e.g., URLs must parse, secrets must meet minimum length). If any check fails, the process throws with a specific error message listing the variable name and the validation failure reason. Optional variables use default values.

The `env.ts` module exports a single typed object that all other modules import — no code reads `process.env` directly outside this file.

### 2. Payload Configuration

Payload CMS is initialized with:
- `@payloadcms/db-postgres` pointing to `DATABASE_URL` (Neon)
- `@payloadcms/storage-s3` configured for R2 (endpoint, region=auto, bucket, credentials)
- `@payloadcms/plugin-multi-tenant` with `tenantsSlug: 'workspaces'`
- Built-in auth on the `users` collection with cookie-based sessions
- Admin panel accessible at `/admin` via the `(payload)` route group
- Session duration set to 24 hours (`maxAge: 86400` on the auth cookie)

### 3. Users Collection (Foundation Scope)

The `users` collection in Phase 1 includes:
- `email` (unique, required) — login credential
- `role` field: `admin` or `owner` (enum, required, default: `owner`)
- Plugin-managed `tenants` array linking to `workspaces` (constrained to exactly one entry for owners)
- Built-in `password`/`salt`/`hash` fields from Payload auth

Access rules:
- `is-admin.access.ts` — gate for admin-only operations
- `is-owner.access.ts` — gate for owner-scoped operations
- Admin panel access restricted to `role === 'admin'` via Payload's `admin.access` callback

### 4. Health and Readiness Endpoints

- `GET /api/health` — returns `{ status: "ok" }` with 200. No dependency checks. Used for liveness probes.
- `GET /api/health/ready` — returns `{ status: "ready" }` with 200 if the database is reachable (simple query), or `{ status: "unhealthy", reason: "..." }` with 503 if any dependency is unreachable.

### 5. Job Route Scaffolding

Each job route placeholder:
- Exists as a valid route handler (not 404)
- Returns `501 Not Implemented` with `{ error: "Not implemented", job: "<job-name>" }`
- Is structured to accept POST requests only
- Will be populated with real logic in Phases 3–5

### 6. Auth Session and Cookie

- Payload's built-in auth handles password hashing, login, and session token issuance
- Session cookie `maxAge` set to 24 hours (86,400 seconds)
- `httpOnly`, `secure` (in production), `sameSite: lax`
- `require-owner-session.ts` verifies the user has role `owner` AND an active session
- `verify-workspace-session.ts` extracts the single workspace from the user's tenants array

### 7. proxy.ts

Minimal `proxy.ts` at project root:
- Exports `proxy` function (Next.js 16 convention)
- Protects `/admin` route from non-admin access by checking a cookie-based session
- Handles no other logic in Phase 1

### 8. pgvector Setup

- The vector extension is enabled via a custom Payload migration in `src/payload/migrations/`
- The migration runs `CREATE EXTENSION IF NOT EXISTS vector`
- The actual `knowledge_vectors` table is created in Phase 4 (not Phase 1)
- Phase 1 only enables the extension so it's available

### 9. Workspace Status Type

A shared type at `src/shared/types/workspace-status.ts` defines the three-value union:
- `active` — AI replies normally
- `paused` — fixed maintenance reply
- `disabled` — hard administrative shutdown

Default for new workspaces: `active` (per clarification Q2).
