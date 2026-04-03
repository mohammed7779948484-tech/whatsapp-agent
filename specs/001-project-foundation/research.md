# Research: Project Foundation

**Branch**: `001-project-foundation`
**Date**: 2026-04-02
**Status**: Complete — no NEEDS CLARIFICATION items remain

## Research Tasks

### 1. Next.js 16.2.x + Payload CMS 3.79.1 Coexistence

**Decision**: Single codebase with Payload embedded inside the Next.js app.

**Rationale**: Payload 3.x is designed to run inside Next.js as a plugin. The `(payload)/admin/[[...segments]]/page.tsx` catch-all route mounts the admin panel. Payload's config is imported by Next.js at build time. This is the officially supported integration path.

**Alternatives considered**:
- Separate Payload backend + Next.js frontend → rejected: doubles deployment complexity, requires API glue code, breaks the single-codebase constitution rule.
- Payload standalone mode → rejected: loses Next.js App Router benefits (Server Components, Server Actions).

**Best practices**:
- Pin Payload to `3.79.1` exactly (constitution requirement).
- Use `@payloadcms/next` for the admin route integration.
- Configure `payload.config.ts` in `src/payload/` and reference it from `next.config.ts`.

---

### 2. Neon PostgreSQL + pgvector

**Decision**: Use Neon as the primary database with pgvector extension enabled via a custom migration.

**Rationale**: Neon supports pgvector natively. The extension can be enabled with `CREATE EXTENSION IF NOT EXISTS vector` in a migration. No special pricing tier is required for pgvector on Neon.

**Alternatives considered**:
- Supabase → rejected: not in the approved stack.
- Separate vector database (Pinecone, Weaviate) → rejected: adds operational complexity for MVP.

**Best practices**:
- Use `@payloadcms/db-postgres` with the Neon connection string.
- Enable pgvector in an early migration so it's available for Phase 4.
- Use connection pooling (Neon provides this automatically via its serverless driver).
- Set `DATABASE_URL` to the pooled connection string for Vercel compatibility.

---

### 3. Cloudflare R2 via @payloadcms/storage-s3

**Decision**: Use `@payloadcms/storage-s3` configured with R2's S3-compatible endpoint.

**Rationale**: R2 is S3-compatible. The `storage-s3` adapter is Payload's official Node.js/Vercel-compatible storage adapter. It works with any S3-compatible endpoint by setting a custom `endpoint` URL.

**Alternatives considered**:
- `@payloadcms/storage-r2` (Workers-only) → rejected: not compatible with Vercel/Node.js runtime.
- Local disk storage → rejected: not durable, not compatible with serverless.
- Direct S3 → rejected: R2 is already chosen in the constitution.

**Best practices**:
- Set `R2_REGION` to `auto` (R2 doesn't use traditional AWS regions).
- Set `R2_ENDPOINT` to the R2 S3-compatible endpoint URL.
- Use `R2_PUBLIC_BASE_URL` for public file access if needed.
- Configure the adapter on the `knowledge_files` collection (Phase 4) — in Phase 1, just register the storage plugin globally.

---

### 4. Payload Multi-Tenant Plugin Configuration

**Decision**: Use `@payloadcms/plugin-multi-tenant` with `tenantsSlug: 'workspaces'`.

**Rationale**: The plugin defaults `tenantsSlug` to `'tenants'`, but the project uses `workspaces` as its tenant entity. The `tenantsSlug` option remaps this. The plugin automatically adds a `tenants` array field to the `users` collection.

**Alternatives considered**:
- Creating a separate `tenants` collection → rejected: constitution explicitly prohibits this.
- Manual tenant isolation without the plugin → rejected: the plugin handles tenant-aware access control, list filtering, and UI automatically.

**Best practices**:
- When changing `tenantsSlug`, may also need to configure `tenantsArrayField` to avoid "collection with slug 'tenants' cannot be found" errors.
- Constrain the tenants array to `maxRows: 1` for owner users (one-workspace-per-owner invariant).
- Verify the plugin loads successfully at boot by checking the admin panel for tenant-aware UI elements.

---

### 5. Environment Validation Pattern

**Decision**: Single `env.ts` module that validates all required variables at import time and exports a typed configuration object.

**Rationale**: Fail-fast prevents partially configured applications from serving traffic. Centralizing env reads in one file prevents scattered `process.env` access and ensures consistent validation.

**Alternatives considered**:
- Runtime validation on first use → rejected: delayed failures are harder to diagnose.
- `.env` schema validation via third-party tool (e.g., `@t3-oss/env-nextjs`) → acceptable alternative, but a simple hand-rolled approach is simpler for the number of variables we have and avoids an extra dependency.
- No validation → rejected: constitution requires fail-fast.

**Best practices**:
- Group variables by category (app, database, storage, auth, external services).
- Validate format where applicable (URLs must parse, secrets must meet minimum length).
- Use `as const` for the exported object to preserve literal types.
- Never import `process.env` directly outside `env.ts`.

---

### 6. Auth Session Configuration

**Decision**: Payload built-in auth with cookie-based sessions, 24-hour expiry.

**Rationale**: Payload's built-in auth handles password hashing (bcrypt), login endpoint, and JWT/cookie session issuance. Setting `maxAge: 86400` on the auth cookie enforces 24-hour expiry (per clarification Q1).

**Alternatives considered**:
- NextAuth.js → rejected: Payload already provides auth; adding another auth system is redundant.
- JWT-only (no cookies) → rejected: cookies are the standard pattern for SSR applications.

**Best practices**:
- Set `httpOnly: true` to prevent XSS access.
- Set `secure: true` in production (HTTPS only).
- Set `sameSite: 'lax'` for CSRF protection while allowing normal navigation.
- The `require-owner-session.ts` guard extracts session → user → role → workspace in a single call chain.

---

### 7. proxy.ts (Next.js 16)

**Decision**: Use `proxy.ts` at project root, exporting a `proxy` function.

**Rationale**: Next.js 16 renamed `middleware.ts` to `proxy.ts` and the exported function from `middleware` to `proxy`. The functionality is identical — it acts as a network-level request boundary.

**Alternatives considered**:
- `middleware.ts` → rejected: deprecated in Next.js 16 (still works with warning but will be removed).

**Best practices**:
- Keep `proxy.ts` thin — only route matching / redirects / header mutation.
- Do NOT perform database queries or heavy auth logic in proxy.
- In Phase 1: protect `/admin` from non-admin access; all other routes pass through.

---

### 8. Testing Baseline

**Decision**: Vitest for unit/integration tests, Playwright for e2e, ESLint for linting.

**Rationale**: Vitest is fast, TypeScript-native, and compatible with the Next.js ecosystem. Playwright is the de facto standard for e2e testing of web applications. ESLint with the flat config (`eslint.config.mjs`) is the current standard.

**Alternatives considered**:
- Jest → rejected: slower, requires more configuration for TypeScript/ESM.
- Cypress → rejected: Playwright has better performance and broader browser support.

**Best practices**:
- Configure `vitest.config.ts` with path aliases matching `tsconfig.json`.
- Configure `playwright.config.ts` with the dev server base URL.
- Add npm scripts: `test`, `test:unit`, `test:integration`, `test:e2e`, `lint`, `typecheck`.
