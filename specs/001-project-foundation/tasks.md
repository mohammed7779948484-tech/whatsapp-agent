# Tasks: Project Foundation

**Input**: Design documents from `/specs/001-project-foundation/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

**Tests**: Not explicitly requested in the spec. Test tasks are excluded. Testing infrastructure setup is included as a setup task only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the repository, install dependencies, and create the project skeleton that all subsequent work builds on.

- [X] T001 Initialize Next.js 16.2.x project with TypeScript strict mode in the project root
- [X] T002 Install Payload CMS 3.79.1 and configure `src/payload/payload.config.ts` with `@payloadcms/next` integration in `next.config.ts`
- [X] T003 Install and configure `@payloadcms/db-postgres` with Neon connection string in `src/payload/payload.config.ts`
- [X] T004 Install and configure `@payloadcms/storage-s3` for Cloudflare R2 in `src/payload/payload.config.ts`
- [X] T005 Install and configure `@payloadcms/plugin-multi-tenant` with `tenantsSlug: 'workspaces'` in `src/payload/payload.config.ts`
- [X] T006 [P] Create the full directory structure matching the constitution Article VI in `src/` (app, features, modules, widgets, payload, core, shared, and all subdirectories)
- [X] T007 [P] Create root configuration files: `tsconfig.json` (strict, path aliases), `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `.gitignore`, `.env.example`
- [X] T008 [P] Create `vitest.config.ts` with path aliases matching `tsconfig.json` and `playwright.config.ts` with dev server base URL
- [X] T009 [P] Add npm scripts to `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `payload`

**Checkpoint**: Project skeleton exists, dependencies installed, configuration files present. Not yet bootable — needs collections and auth.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented. Includes the User and Workspace collections, auth wrappers, environment validation, error handling, and the root layout.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T010 Create the environment validation module with fail-fast behavior in `src/core/env.ts` — validate all required variables (APP_URL, PAYLOAD_SECRET, DATABASE_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) at import time and export a typed config object
- [X] T011 [P] Create the AppError class in `src/core/errors/app-error.ts` and error code constants in `src/core/errors/error-codes.ts`
- [X] T012 [P] Create the structured logger in `src/core/logger/logger.ts` with barrel export in `src/core/logger/index.ts`
- [X] T013 [P] Create the workspace status type union (active, paused, disabled) in `src/shared/types/workspace-status.ts`
- [X] T014 [P] Create the action result type in `src/shared/types/action-result.ts`
- [X] T015 [P] Create the invariant assertion helper in `src/shared/lib/invariant.ts` and safe JSON parser in `src/shared/lib/safe-json.ts`
- [X] T016 Create the Users collection with email, role (admin/owner), and Payload built-in auth (password, salt, hash) in `src/payload/collections/users.collection.ts` — set session cookie maxAge to 86400 (24 hours), restrict admin panel access to `role === 'admin'`
- [X] T017 Create the Workspaces collection with name, slug (unique), and status (default: active) in `src/payload/collections/workspaces.collection.ts`
- [X] T018 Create the collection barrel export in `src/payload/collections/index.ts` exporting Users and Workspaces
- [X] T019 Create admin access control function in `src/payload/access/is-admin.access.ts` checking `user.role === 'admin'`
- [X] T020 [P] Create owner access control function in `src/payload/access/is-owner.access.ts` checking `user.role === 'owner'`
- [X] T021 Create the Payload singleton accessor in `src/payload/lib/get-payload.ts`
- [X] T022 Create the tenant-scoped operation helper in `src/payload/lib/with-tenant-context.ts` enforcing `overrideAccess: false` on tenant queries
- [X] T023 Create a Payload migration to enable pgvector (`CREATE EXTENSION IF NOT EXISTS vector`) in `src/payload/migrations/`
- [X] T024 Create the root layout in `src/app/layout.tsx` with HTML structure, font loading, and metadata
- [X] T025 [P] Create the client providers wrapper in `src/app/providers.tsx`
- [X] T026 Create the Payload Admin Panel catch-all route in `src/app/(payload)/admin/[[...segments]]/page.tsx`
- [X] T027 Create `proxy.ts` at the project root exporting the `proxy` function — protect `/admin` from non-admin access, pass all other routes through
- [X] T028 Create auth session helpers: `src/core/auth/get-session.ts`, `src/core/auth/session-cookie.ts`, `src/core/auth/dal.ts`
- [X] T029 Create auth guard helpers: `src/core/auth/require-owner-session.ts` (verifies role=owner + active session) and `src/core/auth/verify-workspace-session.ts` (extracts single workspace from tenants array)
- [X] T030 Create the auto-generated Payload types file at `src/payload-types.ts` by running `pnpm payload generate:types`
- [X] T031 Create the feature registry barrel export in `src/features/_registry/index.ts` and feature config types in `src/features/_registry/types.ts`

**Checkpoint**: Foundation ready — app boots, Payload Admin accessible, Users and Workspaces collections exist, env validation enforced, auth helpers available. User story implementation can now begin.

---

## Phase 3: User Story 1 — Developer Boots the Application Locally (Priority: P1) 🎯 MVP

**Goal**: A developer can clone the repo, install dependencies, configure env, and start the application locally within 5 minutes. The app starts without errors and serves responses.

**Independent Test**: Start the dev server and visit `http://localhost:3000`. The application responds without errors. Visit `/admin` and see the Payload Admin login screen.

### Implementation for User Story 1

- [X] T032 [US1] Verify the application boots locally by running `pnpm dev` — confirm no startup errors, root URL responds, and `/admin` loads the Payload Admin login screen
- [X] T033 [US1] Create the `README.md` at the project root with setup instructions matching `quickstart.md` (clone, install, configure .env, migrate, seed, start, verify)
- [X] T034 [US1] Create the `pnpm seed:admin` script (or equivalent) that creates the first admin user for local development — document in `README.md`

**Checkpoint**: User Story 1 complete — a developer can go from clone to running app in under 5 minutes.

---

## Phase 4: User Story 2 — Admin Creates the First Customer Account (Priority: P1)

**Goal**: An admin can create a customer owner account via the admin panel. The owner can log in at `/login` and reach the customer dashboard. Invalid credentials are rejected. Unauthenticated visitors are redirected.

**Independent Test**: Create an owner in the admin panel, then log in at `/login`. Verify the dashboard placeholder loads. Try invalid password — verify rejection. Visit `/dashboard` while logged out — verify redirect to `/login`.

### Implementation for User Story 2

- [X] T035 [US2] Create the login page at `src/app/(auth)/login/page.tsx` with email/password form, error messaging, and redirect-on-success to `/dashboard`
- [X] T036 [US2] Create the protected dashboard layout at `src/app/(dashboard)/layout.tsx` — verify owner session on server side, redirect to `/login` if unauthenticated
- [X] T037 [US2] Create the dashboard placeholder page at `src/app/(dashboard)/dashboard/page.tsx` — display the logged-in owner's email and workspace name
- [X] T038 [US2] Verify end-to-end auth flow: admin creates owner in Payload Admin → owner logs in at `/login` → redirected to `/dashboard` → shows placeholder content → logout works

**Checkpoint**: User Story 2 complete — admin can onboard a customer owner, and the owner can authenticate and reach their dashboard.

---

## Phase 5: User Story 3 — System Validates Runtime Configuration (Priority: P1)

**Goal**: The application fails fast with a clear, specific error message when any required environment variable is missing or invalid. When all variables are present and valid, the app boots normally.

**Independent Test**: Remove `DATABASE_URL` from `.env` and start the app — confirm it fails with a message naming `DATABASE_URL`. Restore it and confirm normal boot.

### Implementation for User Story 3

- [ ] T039 [US3] Add format validation to `src/core/env.ts` for URL-type variables (APP_URL, DATABASE_URL, R2_ENDPOINT) — reject malformed URLs with specific error messages
- [ ] T040 [US3] Add minimum-length validation to `src/core/env.ts` for secret-type variables (PAYLOAD_SECRET ≥ 32 chars) — reject short secrets with specific error messages
- [ ] T041 [US3] Add optional variable support to `src/core/env.ts` for Phase 2+ variables (OPENAI_API_KEY, QSTASH_TOKEN, WAHA_BASE_URL, etc.) — validate only when present, use defaults when absent
- [ ] T042 [US3] Verify fail-fast behavior: remove each required variable one at a time and confirm the app refuses to start with a clear message naming the missing variable

**Checkpoint**: User Story 3 complete — env validation is bulletproof and informative.

---

## Phase 6: User Story 4 — Database and File Storage Ready (Priority: P2)

**Goal**: Database is connected with pgvector enabled. File storage is configured for R2. The readiness endpoint confirms connectivity.

**Independent Test**: Start the app, call `/api/health/ready` — confirm `{ status: "ready" }`. Check database for `vector` extension. Verify no local file storage configuration.

### Implementation for User Story 4

- [ ] T043 [US4] Run `pnpm payload migrate` and verify the pgvector extension migration executes successfully — confirm by querying `SELECT * FROM pg_extension WHERE extname = 'vector'`
- [ ] T044 [US4] Verify R2 storage adapter is loaded by Payload at boot — confirm via startup logs that storage-s3 plugin is registered with the R2 endpoint

**Checkpoint**: User Story 4 complete — database and file storage are verified and operational.

---

## Phase 7: User Story 5 — Multi-Tenant Isolation Configured (Priority: P2)

**Goal**: The multi-tenant plugin is loaded and functioning. The admin panel shows tenant-aware UI elements. The Workspaces collection acts as the tenant boundary.

**Independent Test**: Boot the app, open the admin panel, create a workspace. Verify tenant-aware UI elements appear (workspace selector). Create an owner user and assign them a workspace — verify the tenants array is populated.

### Implementation for User Story 5

- [ ] T045 [US5] Verify the multi-tenant plugin loads without errors at boot — confirm tenant-aware UI elements are visible in the Payload Admin panel
- [ ] T046 [US5] Create a workspace via the admin panel and verify it is listed as a selectable tenant context
- [ ] T047 [US5] Create an owner user, assign them a workspace, and verify the plugin-managed tenants array on the user record contains exactly one workspace reference
- [ ] T048 [US5] Verify the `maxRows: 1` constraint on the tenants array for owner users — attempt to add a second workspace and confirm it is rejected or not allowed

**Checkpoint**: User Story 5 complete — tenant isolation is configured and verified at the plugin level.

---

## Phase 8: User Story 6 — Governance and Standards Available (Priority: P3)

**Goal**: Constitution, feature template, and module template files exist at their designated paths and contain the latest approved content.

**Independent Test**: Check that `.specify/memory/constitution.md`, `.specify/memory/standards/feature-template.md`, and `.specify/memory/standards/module-template.md` exist and are non-empty.

### Implementation for User Story 6

- [ ] T049 [P] [US6] Verify `.specify/memory/constitution.md` exists and contains version 1.2.0 content
- [ ] T050 [P] [US6] Verify `.specify/memory/standards/feature-template.md` exists and is non-empty
- [ ] T051 [P] [US6] Verify `.specify/memory/standards/module-template.md` exists and is non-empty

**Checkpoint**: User Story 6 complete — governance files are present and versioned.

---

## Phase 9: User Story 7 — Job and Health Route Scaffolding (Priority: P3)

**Goal**: Health check and readiness endpoints respond correctly. Job route placeholders exist and return 501 Not Implemented. No routes return 404 unexpectedly.

**Independent Test**: Call `GET /api/health` → 200. Call `GET /api/health/ready` → 200 (or 503 if DB unreachable). Call `POST /api/jobs/ingest-parse` → 501.

### Implementation for User Story 7

- [ ] T052 [US7] Create the liveness endpoint at `src/app/api/health/route.ts` — return `{ status: "ok", timestamp }` with 200
- [ ] T053 [US7] Create the readiness endpoint at `src/app/api/health/ready/route.ts` — check DB connectivity via lightweight query, return 200 with `{ status: "ready" }` or 503 with `{ status: "unhealthy", reason }` and 5-second timeout per dependency check; verify negative case by temporarily making the DB unreachable and confirming 503 response (covers SC-007)
- [ ] T054 [P] [US7] Create job route placeholder at `src/app/api/jobs/ingest-parse/route.ts` — POST only, return `{ error: "Not implemented", job: "ingest-parse" }` with 501
- [ ] T055 [P] [US7] Create job route placeholder at `src/app/api/jobs/ingest-chunk/route.ts` — POST only, return 501
- [ ] T056 [P] [US7] Create job route placeholder at `src/app/api/jobs/ingest-embed/route.ts` — POST only, return 501
- [ ] T057 [P] [US7] Create job route placeholder at `src/app/api/jobs/delete-file-artifacts/route.ts` — POST only, return 501
- [ ] T058 [P] [US7] Create job route placeholder at `src/app/api/jobs/cleanup-retention/route.ts` — POST only, return 501
- [ ] T059 [P] [US7] Create job route placeholder at `src/app/api/jobs/process-inbound-message/route.ts` — POST only, return 501
- [ ] T060 [US7] Create the WAHA webhook route placeholder at `src/app/api/webhooks/waha/route.ts` — POST only, return 501

**Checkpoint**: User Story 7 complete — all health and job routes respond with correct status codes.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup across all stories.

- [ ] T061 Run `pnpm typecheck` and confirm zero errors across the entire codebase
- [ ] T062 Run `pnpm lint` and confirm zero errors/warnings across the entire codebase
- [ ] T063 Run `pnpm build` and confirm successful production build
- [ ] T064 [P] Verify the `.env.example` file contains all required and optional variables with placeholder values and comments
- [ ] T065 [P] Create `docs/onboarding-checklist.md` documenting the manual admin workflow for onboarding a new customer (create workspace, create owner, assign workspace)
- [ ] T066 Run the complete quickstart.md validation end-to-end: clone → install → configure → migrate → seed → start → verify all checks pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–9)**: All depend on Foundational phase completion
  - US1 (boot) and US3 (env validation) can proceed immediately after Phase 2
  - US2 (auth) can proceed after Phase 2
  - US4 (DB/storage) can proceed in parallel with US1/US2/US3
  - US5 (multi-tenant) can proceed in parallel with US1/US2/US3
  - US6 (governance) can proceed in parallel with any other story
  - US7 (health/jobs) can proceed in parallel with any other story
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1 — boot)**: After Phase 2. No dependencies on other stories.
- **US2 (P1 — auth)**: After Phase 2. No dependencies on other stories.
- **US3 (P1 — env validation)**: After Phase 2. No dependencies on other stories.
- **US4 (P2 — DB/storage)**: After Phase 2. No dependencies on other stories.
- **US5 (P2 — multi-tenant)**: After Phase 2. No dependencies on other stories.
- **US6 (P3 — governance)**: After Phase 2. No dependencies on other stories. Files already exist in repo.
- **US7 (P3 — health/jobs)**: After Phase 2. No dependencies on other stories.

### Parallel Opportunities

All seven user stories are independently implementable after Phase 2 completes. The only constraint is execution order for P1 stories before P2/P3 if working sequentially.

Within Phase 2, tasks T011–T015 (errors, logger, shared types, invariant) and T019–T020 (access rules) can all run in parallel.

Within Phase 9, all job route placeholders (T054–T060) can run in parallel.

---

## Parallel Example: Phase 2 (Foundational)

```text
# Parallel group A (shared utilities — no dependencies between them):
T011: Create AppError class in src/core/errors/app-error.ts
T012: Create structured logger in src/core/logger/logger.ts
T013: Create workspace status type in src/shared/types/workspace-status.ts
T014: Create action result type in src/shared/types/action-result.ts
T015: Create invariant helper in src/shared/lib/invariant.ts

# Parallel group B (access rules — no dependencies between them):
T019: Create is-admin.access.ts
T020: Create is-owner.access.ts
```

## Parallel Example: Phase 9 (Health & Jobs)

```text
# Parallel group (all job scaffolds — different files, same pattern):
T054: Create ingest-parse route placeholder
T055: Create ingest-chunk route placeholder
T056: Create ingest-embed route placeholder
T057: Create delete-file-artifacts route placeholder
T058: Create cleanup-retention route placeholder
T059: Create process-inbound-message route placeholder
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Boot verification
4. Complete Phase 4: US2 — Auth flow
5. Complete Phase 5: US3 — Env validation
6. **STOP and VALIDATE**: The core app is bootable with working auth and fail-fast config

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (boot) → Verify app starts cleanly
3. Add US2 (auth) → Verify admin can create owner, owner can log in
4. Add US3 (env validation) → Verify fail-fast behavior
5. Add US4–US5 → Infrastructure verified
6. Add US6–US7 → Full Phase 1 foundation complete
7. Polish → Ship-ready foundation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
