# AGENTS.md

This file gives coding agents the operating conventions for this repository.
Use it as the practical companion to `.specify/memory/constitution.md`.

## Project Snapshot

- Stack: Next.js 16, React 19, TypeScript strict mode, Payload CMS 3, PostgreSQL, Cloudflare R2
- Package manager: `pnpm`
- Module system: ESM (`"type": "module"` in `package.json`)
- Main app folders: `src/app`, `src/payload`, `src/core`, `src/shared`
- Payload types file: `src/payload-types.ts`

## External Instruction Sources

Checked during creation of this file:

- No `.cursor/rules/` directory found
- No `.cursorrules` file found
- No `.github/copilot-instructions.md` file found

If any of those files are added later, treat them as additional repository rules.

## Core Commands

Run commands from the repository root: `C:\Users\M\Desktop\AIagents`

### Development

- Start dev server: `pnpm dev`
- Start production server after build: `pnpm start`
- Build app: `pnpm build`

### Quality Checks

- Typecheck all TS: `pnpm typecheck`
- Lint repo: `pnpm lint`
- Run all tests: `pnpm test`

### Targeted Tests

- Run all unit tests: `pnpm test:unit`
- Run all integration tests: `pnpm test:integration`
- Run Playwright tests: `pnpm test:e2e`

### Run a Single Vitest File

- Single unit/integration file: `pnpm vitest run tests/unit/payload/access.test.ts`
- Another example: `pnpm vitest run tests/integration/proxy.test.ts`

### Run a Single Vitest Test Name

- By test name: `pnpm vitest run -t "allows anonymous access to the admin login screen"`
- Combine file + test name when needed:
  `pnpm vitest run tests/integration/proxy.test.ts -t "redirects owner sessions away from admin routes"`

### Watch Mode for One Test File

- `pnpm vitest tests/unit/payload/access.test.ts`

### Payload / Data Commands

- Payload CLI: `pnpm payload`
- Generate Payload types: `pnpm payload generate:types`
- Generate Payload import map: `pnpm payload generate:importmap`
- Run migrations: `pnpm payload migrate`
- Check migration status: `pnpm payload migrate:status`

### Seed Commands

- Seed admin: `pnpm seed:admin`
- Seed dev data: `pnpm seed:dev`

## Required Validation Sequence

For meaningful code changes, run at least:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build` for broad or routing/Payload changes

For Payload schema/config changes, also run when possible:

1. `pnpm payload generate:types`
2. `pnpm payload generate:importmap`
3. `pnpm payload migrate:status`

## Architecture Rules

Follow the constitution strictly.

### Layer Responsibilities

- `src/app/` = routing, layouts, route handlers, entrypoints
- `src/widgets/` = composite UI blocks
- `src/features/` = user-facing feature slices
- `src/modules/` = domain/application services and validators
- `src/payload/` = collections, hooks, access rules, Payload config
- `src/core/` = cross-cutting infrastructure
- `src/shared/` = reusable primitives, utilities, common types

### Import Boundaries

- Imports must flow downward only
- No circular dependencies
- Cross-boundary imports must use public `index.ts` exports where available
- Use relative imports only within the same local package area
- Avoid deep imports across boundaries

### Payload Ownership Rules

- Collections only in `src/payload/collections/`
- Access helpers only in `src/payload/access/`
- Hooks only in `src/payload/hooks/`
- Do not define schema in features/modules
- If a task is Payload-specific, consult the local Payload skill/reference docs before guessing behavior

## TypeScript Rules

- Strict mode is enabled; keep code fully type-safe
- `any` is forbidden (`@typescript-eslint/no-explicit-any` is enabled)
- Prefer `unknown` over `any` when narrowing is needed
- Use `import type` for type-only imports where possible
- Preserve explicit return types on exported functions when useful for clarity
- Respect `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`

## Naming Rules

- Folders: `kebab-case`
- React component files: `PascalCase.tsx`
- Other files: `[purpose].[type].ts`
- Server actions: `[verb-noun].action.ts`
- Route handlers: `route.ts`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

## Import Style

- Prefer alias imports with `@/` for cross-project imports
- Valid path aliases include:
  - `@/*` -> `src/*`
  - `@/payload-types` -> `src/payload-types.ts`
  - `@payload-config` -> `src/payload/payload.config.ts`
- Keep import groups tidy and stable
- Remove dead imports immediately

## Formatting and Style

- Match the existing file style instead of reformatting unrelated code
- Use semicolons where the surrounding file uses them
- Keep code explicit and boring over clever abstractions
- Avoid inline styles in React
- Keep comments minimal and only for non-obvious logic

## Error Handling

- Prefer `AppError` for domain/application failures
- Reuse `ErrorCode` constants from `src/core/errors/error-codes.ts`
- Return clear, user-meaningful error messages for invariant violations
- In hooks/services, fail loudly for invalid cross-tenant or invalid relationship states
- Use `_error` / `_unused` naming when intentionally ignoring values to satisfy lint rules

## Payload-Specific Guidance

- Tenant-owned data must be workspace-scoped
- For user-facing Local API operations, use `overrideAccess: false`
- For internal/system operations, use `overrideAccess: true` only when justified
- Keep `workspace` relationships consistent with parent relations; do not trust denormalized input blindly
- `message_traces` must remain admin-only
- `knowledge_files` is upload-enabled and uses Payload-managed file metadata
- Accepted v1 knowledge file types are PDF and CSV only

## Auth and Tenant Rules

- Owners must map to exactly one workspace
- Admins use the Payload Admin panel
- Owners must never gain admin panel access
- Cross-tenant reads/writes are security bugs
- Use shared workspace-resolution helpers instead of duplicating tenant logic

## Tests and Verification Expectations

- Add or update tests when fixing business rules or access logic
- Favor focused unit tests for hooks/access helpers
- Favor integration tests for routes and auth/proxy behavior
- Do not mark a spec done just because tasks are checked off; verify the code and behavior

## Editing and Git Hygiene

- Do not revert unrelated user changes
- Keep edits scoped to the real problem
- Do not add dependencies unless necessary
- Do not create commits unless explicitly asked
- If asked to commit, review `git status`, `git diff`, and recent commit style first

## Good Agent Behavior in This Repo

- Read the relevant spec/tasks before changing implementation-heavy code
- For Payload questions, read the Payload skill/reference first
- Verify before claiming success
- Fix real issues, not cosmetic ones
- Re-run validation after fixes
- Update docs when behavior or architecture materially changes
