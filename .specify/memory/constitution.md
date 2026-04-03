<!--
SYNC IMPACT REPORT
==================
Version Change  : 1.1.0 → 1.2.0
Bump Rationale  : MINOR — aligned governance to final runtime architecture: adopt Next.js 16 `proxy.ts`,
                  formalize Payload multi-tenant config using `workspaces` as `tenantsSlug`,
                  require HMAC + IP allowlist for WAHA webhooks, and remove repository language
                  from module responsibilities to match the approved module template.

Modified Principles:
  - Article IV  : formalized plugin config (`tenantsSlug: 'workspaces'`) and owner scoping
  - Article VI  : root structure updated for `proxy.ts` and Payload admin App Router route
  - Article VIII: WAHA webhook validation upgraded to HMAC + IP allowlist
  - Layering    : module responsibilities updated to match approved module template

Added Sections  : None
Removed Sections: None

Templates Updated:
  ✅ .specify/memory/constitution.md  — this file (amended)
  ⚠  .specify/templates/plan-template.md  — pending
  ⚠  .specify/templates/spec-template.md  — pending
  ⚠  .specify/templates/tasks-template.md — pending

Deferred TODOs:
  TODO(RATIFICATION_DATE): Exact first-commit / project kickoff date unknown — marked below.
       Update when repo is initialized and first commit is dated.
-->

# WhatsApp AI SaaS Platform Constitution

## Core Principles

### I. MVP Scope Discipline

The platform is **invite-only** and targets a strictly bounded MVP. Every engineering decision
MUST be evaluated against this scope before any work begins.

**Non-negotiable rules:**

- The platform MUST be invite-only; no public signup, no self-service onboarding in v1.
- Accounts MUST be created manually by internal Admin only.
- Each customer MUST have exactly one owner account, one workspace, one AI agent,
  and one connected WhatsApp number.
- Features outside approved MVP scope MUST be rejected without exception.

**Explicitly out of scope in v1** (rejection is mandatory, not optional):

- Public signup, self-service onboarding, automated trial flows
- Staff roles and multiple workspaces per customer
- Multiple agents per workspace
- Live Shopify, Salla, or ERP integrations
- Upsell flows, lead capture, CRM logic
- Ticketing / handoff workflows
- Analytics beyond minimal counters
- Voice, image, and document understanding in customer chats

### II. Product Boundaries

The agent MUST answer only about products, prices, stock availability (when explicitly
present in source data), store policies, shipping, and working hours. Nothing else.

**Non-negotiable rules:**

- Knowledge is static in v1; it MUST come only from customer-uploaded files.
- The platform MUST NOT promise live inventory or live price synchronization.
- Unsupported customer message types MUST receive a fixed text-only reply.
- No capability outside these boundaries may be introduced without a constitutional amendment.

### III. Truthfulness Over Coverage

The agent MUST never hallucinate. Conservative, accurate answers are required even when
this means lower coverage. Certainty without evidence is categorically prohibited.

**Non-negotiable rules:**

- The agent MUST NEVER guess, infer, or extrapolate a price or stock state unless
  it is explicitly present in retrieved source text.
- If information is missing, weak, ambiguous, stale-looking, or conflicting, the agent
  MUST return the configured fallback reply.
- Lower answer coverage is acceptable; hallucinated certainty is not.
- Temperature and prompting MUST favor deterministic, conservative answers.

**Source-of-truth rules:**

- Across multiple files, the most recently uploaded file wins.
- If conflicting values appear inside the same file or same retrieval context,
  fallback MUST be used.
- The agent MUST NOT silently choose one conflicting value unless timestamp precedence
  is clear at file level.

### IV. Tenant Isolation and Access Safety

Every data read or write MUST be scoped to the correct tenant. Cross-tenant data access
is a critical security violation and MUST be prevented at the application layer.

**Non-negotiable rules:**

- Tenant isolation MUST use the Payload multi-tenant plugin plus strict access control.
- Customers MUST NEVER access the Payload Admin Panel.
- Internal Admin uses the Payload Admin Panel exclusively.
- Tenant-scoped reads and writes MUST respect tenant context at all times.
- Sensitive Local API operations MUST explicitly use `overrideAccess: false`.
- Collection, global, and field access rules are MANDATORY on all tenant-owned data.

**Tenant-owned data (exhaustive list for v1):**

- workspaces, agents, knowledge files, parsed chunks, conversations, messages, traces,
  WhatsApp session metadata, workspace operational status

**Plugin configuration rules:**

- The Payload multi-tenant plugin MUST be configured with `tenantsSlug: 'workspaces'` in v1.
- The plugin-managed tenants array on `users` MUST be constrained to exactly one workspace for owner users in v1.
- No separate `tenants` business collection may be introduced in v1 unless the constitution is amended.

### V. Serverless-First Runtime

The application MUST be designed so no request-response cycle is blocked by long-running
work. Async, queue-based execution is the mandatory pattern for heavy operations.

**Non-negotiable rules:**

- The application runs as a single Next.js + Payload codebase deployed on Vercel.
- WAHA MUST be deployed separately and MUST NEVER be colocated with the Vercel runtime.
- Long-running work MUST NEVER block request-response cycles.
- Parsing, chunking, and embeddings MUST run asynchronously through queue-based execution.
- Webhooks MUST acknowledge fast (200 OK) and continue processing after acknowledgment.

### VI. Architecture and Layering

Imports flow downward only. No circular dependencies. This layering is enforced without exceptions.

**Top-level structure:**

```text
project-root/
├── .specify/
│   └── memory/
│       ├── constitution.md
│       └── standards/
│           ├── feature-template.md
│           └── module-template.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (payload)/
│   │   │   └── admin/
│   │   │       └── [[...segments]]/
│   │   │           └── page.tsx
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── api/
│   │   └── providers.tsx
│   ├── widgets/
│   ├── features/
│   ├── modules/
│   ├── payload/
│   │   ├── access/
│   │   ├── admin/
│   │   ├── collections/
│   │   ├── globals/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── payload.config.ts
│   ├── core/
│   ├── shared/
│   └── payload-types.ts
├── public/
└── proxy.ts
```

**Layer responsibilities:**

- `app/` — routing, page composition, route handlers, entrypoints
- `widgets/` — composite UI blocks used by pages
- `features/` — user-facing feature slices (UI + actions + feature-local orchestration)
- `modules/` — domain/application services, validators, and optional provider helpers
- `payload/` — collections, hooks, access rules, admin customization, payload config
- `core/` — cross-cutting infrastructure
- `shared/` — primitives, utilities, reusable UI atoms, common types

**Dependency rules (MUST be respected without exception):**

| Layer | MAY import | MUST NOT import |
|---|---|---|
| `app/` pages/layouts | widgets, features, shared | modules, payload, deep infra |
| `app/api/**/route.ts` | modules, payload/lib, core, shared | widgets, page-only UI |
| `widgets/` | features, shared | app, payload, direct DB logic |
| `features/` | modules, core, shared | other features, app, widgets, payload/collections, payload/hooks, direct DB |
| `modules/` | other modules (via index.ts), core, shared, payload/lib, @/payload-types | app, widgets, features, payload/collections, payload/admin, payload/hooks |
| `payload/` | modules, core, shared | — |
| `core/` | shared | — |
| `shared/` | external libraries, local files inside shared | — |

**Universal layering rules:**

1. Imports flow downward only. No circular dependencies.
2. Cross-boundary imports MUST use the public `index.ts` of the target module/feature.
3. Relative imports are allowed only inside the same feature/module/shared package.
4. No deep imports across boundaries.

### VII. Payload Ownership Rules

All Payload configuration artifacts MUST live centrally in designated directories.
Features do not define schema; the Payload layer owns schema exclusively.

**Non-negotiable rules:**

- All collection configs MUST live in `src/payload/collections/`.
- All access control functions MUST live in `src/payload/access/`.
- All hooks MUST live in `src/payload/hooks/`.
- Features MUST NOT define `schema.ts`.
- Modules MAY encapsulate queries/mutations against Payload collections, but collection
  definitions remain centralized.

### VIII. WhatsApp Integration Rules

WAHA is the only WhatsApp gateway in v1. The integration contract is strict and must
not be altered without a constitutional amendment.

**Non-negotiable rules:**

- WAHA MUST run with the `gows` engine only.
- Each workspace maps to one WAHA session named `workspace_${workspaceId}`.
- WAHA MUST be hosted on separate infrastructure (not Vercel).
- Inbound WAHA webhooks MUST be validated before processing using HMAC signature verification plus IP allowlist.
- The webhook handler MUST return `200 OK` immediately.
- AI processing MUST happen after acknowledgment, not before.
- Unsupported message types MUST receive a fixed text-only reply.
- Paused or disabled workspaces MUST receive a fixed unavailability reply without invoking the LLM.

### IX. AI Runtime Rules

The AI layer uses Vercel AI SDK Core with a conservative, traceable configuration.
No experimental or heavy patterns are permitted in v1.

**Non-negotiable rules:**

- Use `generateText` (not `streamText`) for webhook-driven WhatsApp replies.
- Tool calling is optional and MUST NOT be introduced without a demonstrated need.
- `ToolLoopAgent`, MCP tools, and human approval flows are NOT part of v1.
- System prompt, retrieved chunks, and final outcome MUST be traceable for Admin debugging.
- Session context MUST be: latest 10 messages + top 3 retrieved chunks + system rules.
- Session MUST reset after 24 hours of inactivity.

### X. Knowledge Ingestion Rules

Knowledge ingestion is asynchronous, file-scoped, and must maintain observable status
throughout the pipeline.

**Non-negotiable rules:**

- Accepted file types in v1: PDF and CSV only.
- Files are treated as unstructured knowledge; no strict CSV schema required.
- LlamaParse MUST be the parsing provider.
- Upstash QStash MUST be the async orchestration mechanism.
- Embeddings MUST be generated asynchronously.
- File deletion MUST remove associated chunks and embeddings.
- Knowledge freshness MUST be visible in the customer UI.
- Parsing/embedding failures MUST be visible in Admin and customer status surfaces.

## Stack Decisions

All stack choices below are locked for v1. Changes require a constitutional amendment.

**Runtime and platform:**

- Next.js 16.2.x
- React 19.2.x
- TypeScript strict mode — `any` is PROHIBITED
- Node.js 20.9+ or 22 LTS
- Vercel for main app
- WAHA on separate VPS / Railway / Render

**Backend and data:**

- Payload CMS 3.79.1 (pinned — do not upgrade without amendment)
- Neon PostgreSQL with pgvector enabled
- Cloudflare R2 for file storage

**AI and async:**

- Vercel AI SDK Core
- OpenAI `gpt-4o-mini`
- OpenAI `text-embedding-3-small`
- LlamaParse
- Upstash QStash

**Frontend:**

- Tailwind CSS v4
- shadcn/ui
- Server Components by default
- Minimal client state only when necessary

## Naming, Code Style, and UI Standards

**Naming conventions (MUST be followed):**

- Folders: `kebab-case`
- React component files: `PascalCase.tsx`
- Other files: `[purpose].[type].ts`
- Server actions: `[verb-noun].action.ts`
- Route handlers in `app/api/`: use Next.js standard `route.ts` (no custom naming)
- Handler/service/helper filenames must be explicit:
  e.g., `whatsapp-webhook.handler.ts`, `knowledge-ingest.service.ts`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Always use path alias `@/`
- Use `import type` for types when possible

**Code style rules:**

- No `any`
- No inline styles
- No cross-feature imports
- No magic strings for domain enums when a constant or type should exist

**Customer dashboard surfaces (required in v1):**

- Login, Dashboard, Agent Settings, Knowledge Uploads, WhatsApp Connection, Conversations (view-only)
- Admin functionality belongs in Payload Admin Panel unless there is a proven exception.
- No separate internal admin app surface MUST be built in v1 without approved requirement.

## Observability and Retention

Every inbound message MUST be persisted or traceable. The following data MUST be stored
per interaction: inbound message, outbound reply, retrieved chunks, prompt snapshot,
model outcome, failure reason (when applicable).

**Retention rules:**

- Conversations are retained for 30 days.
- Knowledge files remain stored while the account is active.
- Disabling a workspace stops AI execution but MUST NOT delete files in v1.

## Testing Standards

Critical paths require automated tests. No feature is considered complete without tests
covering the security and failure modes it introduces.

**Mandatory test coverage targets for v1:**

- Tenant access enforcement
- Workspace status gate (active/paused/disabled behavior)
- Unsupported message type handling
- Webhook validation
- Duplicate webhook idempotency
- Fallback on missing or conflicting knowledge
- File delete cleanup for chunks/embeddings
- Session reset after 24 hours
- Dashboard behavior on paused/disabled workspace

**Testing rules:**

1. Modules MUST have unit tests for critical business rules.
2. Route handlers MUST have integration tests for happy path and failure path.
3. Customer-critical end-to-end flows MUST have Playwright coverage where practical.
4. No feature is complete without tests for the security and failure modes it introduces.

## Governance

**Amendment procedure:**

1. Any rule change requires updating this constitution before implementation begins.
2. If a new requirement cannot fit this constitution cleanly, the constitution MUST be
   amended first.
3. Constitution violations block merge — convenience never overrides rules.
4. When a rule conflicts with convenience, the rule wins.

**Versioning policy:**

- MAJOR: Backward-incompatible governance/principle removals or redefinitions.
- MINOR: New principle or section added or materially expanded.
- PATCH: Clarifications, wording fixes, non-semantic refinements.

**Development principles:**

- Prefer explicit, boring code over clever abstractions.
- Build the smallest correct version first.
- Complexity MUST be justified in writing before introduction.

**Version**: 1.2.0 | **Ratified**: TODO(RATIFICATION_DATE): set to repo init date | **Last Amended**: 2026-04-02
