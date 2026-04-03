
# WhatsApp Agent SaaS - Implementation Plan

**Version**: 1.1.0  
**Date**: 2026-04-02  
**Status**: Approved with architecture fixes applied  
**Constitution**: v1.2.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Decisions](#key-decisions)
3. [Architecture Overview](#architecture-overview)
4. [Domain Model](#domain-model)
5. [Database Schema](#database-schema)
6. [WAHA Integration](#waha-integration)
7. [Knowledge Ingestion Pipeline](#knowledge-ingestion-pipeline)
8. [AI Reply Pipeline](#ai-reply-pipeline)
9. [API Endpoints](#api-endpoints)
10. [Frontend Structure](#frontend-structure)
11. [Security and Access Control](#security-and-access-control)
12. [Deployment and Infrastructure](#deployment-and-infrastructure)
13. [Build Order](#build-order)
14. [Environment Variables](#environment-variables)
15. [Verification Checklist](#verification-checklist)
16. [Files to Create](#files-to-create)
17. [Appendix: Build-Phase Extraction Note](#appendix-build-phase-extraction-note)
18. [Appendix: Deferred Items (Not in v1)](#appendix-deferred-items-not-in-v1)

## Executive Summary

This project is a closed SaaS platform for small merchants to run one WhatsApp AI assistant per store.

The platform is intentionally narrow:
- invite-only onboarding
- one owner per account
- one workspace per customer
- one agent per workspace
- one WhatsApp number per workspace
- static knowledge only
- no live commerce integrations in v1
- no CRM, lead capture, upsell, or staff workflows in v1
- no billing, subscription, invoice, trial, or payment system in v1

The system is built as a single Next.js + Payload codebase deployed on Vercel, with WAHA deployed separately as the WhatsApp gateway. Customer-uploaded PDFs and CSVs are stored in Cloudflare R2 through a Payload upload-enabled `knowledge_files` collection backed by `@payloadcms/storage-s3`, parsed by LlamaParse, chunked and embedded asynchronously through chained QStash jobs, then retrieved from Neon PostgreSQL with pgvector. The AI response path uses OpenAI `gpt-4o-mini` with strict fallback rules to minimize hallucinations.

### Core Product Rules

- **Tenancy**: Workspace-based; the Payload multi-tenant plugin is configured with `tenantsSlug: 'workspaces'`, and in v1 `tenantId` and `workspaceId` are the same value in all tenant-scoped flows
- **Ownership**: One customer owner account only in v1
- **Workspace Operations**: Admin manually controls workspace runtime availability through operational status only
- **Knowledge**: Static uploaded files only; no Shopify/Salla sync
- **WhatsApp Gateway**: WAHA only, self-hosted, GOWS engine only
- **LLM Safety**: Never infer prices or stock unless explicitly present in retrieved text
- **Frontend Scope**: Minimal customer dashboard only; Payload Admin reserved for internal Admin
- **Dashboard Pattern**: Server Components for reads, Server Actions for customer mutations
- **Webhook Pattern**: Route Handlers only for external or machine-to-machine flows

### Workspace Status Model

There is **no billing state** in v1.

The only operational control is:
- `active`
- `paused`
- `disabled`

Behavior:
- `active`: AI replies normally
- `paused`: fixed maintenance reply, no OpenAI call
- `disabled`: fixed maintenance reply, no OpenAI call, used for hard administrative shutdown

In v1, workspace status controls **AI runtime availability only**.
It does **not** delete data and does **not** introduce a billing-style read-only mode.

### Fixed System Replies

The following replies are **built-in locale-aware constants** in v1 and are **not customer-editable**:
- unavailability reply
- unsupported message type reply
- fallback reply

The initial supported locales are:
- Arabic
- English

Locale selection rule in v1:
- use `agent.language_preference` if it is set
- otherwise detect the locale from the latest inbound text using `shared/lib/locale-from-text.ts`
- if detection is unclear, default to Arabic

### Build-Phase Extraction Note

This document preserves the approved 7-phase build order.
Specification extraction is intentionally handled later by a separate agent and is therefore **out of scope for this implementation plan document itself**.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App structure | Single monorepo, single Next.js + Payload codebase | Simplifies deployment, auth, type sharing, and AI-generated code navigation |
| Frontend framework | Next.js 16.2.x (App Router) | Current stable track with App Router maturity and Payload compatibility path |
| CMS / Auth | Payload CMS 3.79.1 pinned + Payload built-in auth | Fastest path with consistent user/session handling |
| Database | Neon PostgreSQL | Agreed primary database; serverless Postgres fits Vercel deployment |
| Vector store | Dedicated `pgvector` SQL table (`knowledge_vectors`) | Practical similarity search without forcing vectors into normal Payload collections |
| File storage | Payload upload-enabled `knowledge_files` collection backed by `@payloadcms/storage-s3` to Cloudflare R2 | Lets Payload manage upload lifecycle while storing files durably in R2 |
| WhatsApp gateway | WAHA, GOWS engine only | Lower resource usage than browser-based engines and clearer operational boundary |
| Queue | Upstash QStash | Primary async orchestration path for webhook/job resilience |
| Parser | LlamaParse | Strong handling for PDFs and semi-structured business documents |
| Chat model | OpenAI `gpt-4o-mini` | Fast and cost-efficient for constrained RAG replies |
| Embeddings | OpenAI `text-embedding-3-small` | Good MVP balance between quality and cost |
| Session window | Latest 10 messages | Enough context without runaway token usage |
| Session reset | 24 hours inactivity | Matches WhatsApp operational expectations |
| Workspace pause behavior | Static locale-aware reply only, no LLM execution | Saves cost and avoids silent failures |
| Unsupported message types | Static locale-aware text-only reply | Keeps v1 strictly text-only |
| Tenant isolation | Payload multi-tenant + access control with `tenantsSlug: 'workspaces'` | Keeps domain language as workspaces while satisfying plugin requirements |
| Local API access | `overrideAccess: false` on sensitive user-facing operations | Prevents accidental bypass of Payload access rules |
| Dashboard data pattern | Server Components for reads | Matches Next.js App Router and avoids unnecessary internal REST |
| Dashboard mutation pattern | Server Actions | Matches approved feature template and keeps customer flows simple |
| Route handlers | External and machine-to-machine only | Reserved for WAHA webhooks, QStash jobs, and health checks |
| Module data pattern | Services call Payload Local API directly | Simpler than mandatory repository layer and matches approved module template |
| Users tenant field | Plugin-managed tenants array constrained to one workspace for owners | Avoids conflict with the one-owner / one-workspace invariant |
| Webhook security | HMAC signature + IP allowlist | Stronger than a static header and supported by WAHA |
| R2 adapter | `@payloadcms/storage-s3` configured for R2 | Official Node/Vercel-compatible adapter path |
| Ingestion orchestration | Chained QStash jobs (`parse` → `chunk` → `embed`) | Avoids Vercel timeout risk for large files |
| Retention trigger | QStash scheduled job | Keeps async cleanup inside the chosen job system |
| Fixed replies | Hardcoded locale-aware constants | Simplest safe MVP without editable system behavior |
| Chunking | Heading-aware / paragraph-aware; 600 tokens, 80 overlap | Conservative default for mixed PDF / CSV content |
| Conversations retention | 30 days | Cost and database control |
| Knowledge conflict rule | Latest uploaded file wins across files | Clear, deterministic source-of-truth rule |
| Intra-file conflict rule | Fallback reply | Avoids fabricated certainty |

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Customer Browser                            │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js App Router                                                 │
│  - Login                                                            │
│  - Dashboard                                                        │
│  - Agent Settings                                                   │
│  - Knowledge Uploads                                                │
│  - WhatsApp Connection                                              │
│  - Conversations                                                    │
│                                                                     │
│  Read path: Server Components                                       │
│  Write path: Server Actions                                         │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Vercel (Main Application)                        │
├─────────────────────────────────────────────────────────────────────┤
│ Next.js 16.2.x + Payload CMS 3.79.1                                 │
│                                                                     │
│ app/api/                                                             │
│  - health checks                                                    │
│  - WAHA inbound webhook                                             │
│  - QStash job endpoints                                              │
│                                                                     │
│ src/payload/                                                         │
│  - collections                                                      │
│  - access                                                           │
│  - hooks                                                            │
│  - admin                                                            │
│                                                                     │
│ src/modules/                                                         │
│  - agents                                                           │
│  - ai-agent                                                         │
│  - conversations                                                    │
│  - ingestion-jobs                                                   │
│  - knowledge                                                        │
│  - tracing                                                          │
│  - whatsapp                                                         │
│  - workspaces                                                       │
└─────────────────────────────────────────────────────────────────────┘
            │                         │                         │
            ▼                         ▼                         ▼
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│ Neon PostgreSQL    │    │ Cloudflare R2      │    │ Upstash QStash     │
│ + pgvector         │    │ uploaded files     │    │ async delivery      │
└────────────────────┘    └────────────────────┘    └────────────────────┘
            │                                                    │
            ▼                                                    ▼
┌────────────────────┐                                  ┌────────────────────┐
│ OpenAI             │                                  │ LlamaParse         │
│ - gpt-4o-mini      │                                  │ parse PDFs / CSVs  │
│ - embeddings       │                                  └────────────────────┘
└────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WAHA (Separate Infrastructure)                  │
├─────────────────────────────────────────────────────────────────────┤
│ Self-hosted container                                               │
│ - GOWS engine only                                                  │
│ - one WAHA session per workspace                                    │
│ - QR authentication                                                 │
│ - webhook delivery to Vercel                                        │
│ - outbound message relay                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Runtime Boundaries

| Boundary | Purpose |
|----------|---------|
| Vercel main app | Customer dashboard, route handlers, AI orchestration, Payload Admin |
| Neon | Source of truth for tenant data, conversations, traces, knowledge metadata, vectors |
| R2 | Durable storage for uploaded files |
| QStash | Async ingestion orchestration and webhook message processing dispatch |
| WAHA host | WhatsApp session lifecycle, QR, inbound/outbound messaging |
| OpenAI | Embeddings and final conservative answer generation |
| LlamaParse | External parsing for unstructured files |

### Interaction Pattern Summary

- Customer dashboard reads use Server Components
- Customer dashboard mutations use Server Actions
- Route Handlers are reserved for:
  - `GET /api/health`
  - `GET /api/health/ready`
  - `POST /api/webhooks/waha`
  - `POST /api/jobs/*`

## Domain Model

### Owner User
Represents the customer login for one store.

Properties:
- one owner account only in v1
- belongs to exactly one workspace in practice
- can access customer dashboard only
- never accesses Payload Admin Panel

### Workspace
Represents the tenant boundary and operating unit.

Properties:
- exactly one per customer in v1
- owns all tenant-scoped data
- has one agent
- has one WAHA session
- has one operational status

### Tenant ID Rule
In v1, `tenantId` and `workspaceId` are the same identifier in all tenant-scoped flows.

This means:
- the Payload multi-tenant plugin uses `workspaces` as `tenantsSlug`
- feature server actions resolve the workspace from the verified session
- module services receive `tenantId`
- tenant-owned Payload queries scope by `workspace` / `tenant` according to collection shape
- the workspace is still the tenant root entity

### Multi-Tenant Plugin Configuration
The plan does not introduce a separate business `tenants` collection.

Instead:
- `workspaces` is the tenant collection slug for the plugin
- the plugin-managed tenants array on `users` is kept and constrained to exactly one workspace for owner users in v1
- no separate custom `users.workspace` relation is used in v1; owner workspace resolution comes from the plugin-managed tenants array
- owner-facing session helpers resolve the single allowed workspace from the verified user

### Workspace Status
Controls runtime availability.

Allowed values:
- `active`
- `paused`
- `disabled`

Runtime meaning:
- `active`: allow AI execution
- `paused`: return static unavailability reply
- `disabled`: return static unavailability reply and treat as admin shutdown

### Agent
Represents the customer-configured assistant.

Stores:
- agent display name
- response style
- hard rules
- system prompt
- quick instructions
- language preference if needed

### WhatsApp Session
Represents the WAHA session linked to one workspace.

Stores:
- session name (`workspace_${workspaceId}`)
- provider status
- QR state
- connected phone metadata
- last heartbeat / sync timestamps

### Knowledge File
Represents one uploaded customer file:
- PDF or CSV
- stored in R2
- parse status
- ingestion status
- source freshness timestamp
- upload timestamp

### Knowledge Chunk
Represents one searchable chunk extracted from a file:
- chunk text
- chunk index
- metadata
- vector linkage
- source file linkage

### Conversation
Represents one customer chat thread inside one 24h session window.

Stores:
- workspace
- WhatsApp remote identifier
- session boundary timestamps
- latest activity timestamp

### Message
Represents one inbound or outbound text message.

Stores:
- conversation
- direction (`inbound` / `outbound`)
- message body
- provider IDs
- timestamps
- delivery status if outbound

### Message Trace
Represents the debug trail for one AI-handled inbound message.

Stores:
- retrieved chunks snapshot
- prompt snapshot
- model info
- safety outcome
- fallback reason if used
- send result

### Ingestion Job
Represents async file processing state.

Stores:
- workspace
- file
- current stage
- attempts
- last error
- timestamps

## Database Schema

### Core Collections (Payload)

| Collection | Purpose | Tenant-Owned |
|------------|---------|--------------|
| `users` | Customer owners and internal admins | No |
| `workspaces` | Tenant root entity | Root entity |
| `agents` | One agent per workspace | Yes |
| `whatsapp_sessions` | WAHA session metadata | Yes |
| `knowledge_files` | Uploaded source files metadata | Yes |
| `knowledge_chunks` | Parsed chunk metadata and source linkage | Yes |
| `conversations` | Chat session threads | Yes |
| `messages` | Inbound/outbound messages | Yes |
| `message_traces` | AI debug traces (admin-only visibility) | Yes |
| `ingestion_jobs` | Async ingestion lifecycle | Yes |

### SQL Tables Outside Payload Collections

| Table | Purpose |
|-------|---------|
| `knowledge_vectors` | `pgvector` storage for chunk embeddings |
| optional audit/helper tables | only if required during implementation |

### Proposed Field Shapes

#### `users`
- `email`
- `password`
- `role` = `admin | owner`
- plugin-managed tenants array constrained to exactly one workspace for owner users in v1
- auth metadata

#### `workspaces`
- `name`
- `slug`
- `status` = `active | paused | disabled`
- `owner` relation
- `last_knowledge_update_at`
- `created_at`
- `updated_at`

#### `agents`
- `workspace`
- `display_name`
- `response_style`
- `system_prompt`
- `quick_instructions`
- `language_preference`
- `is_enabled`

#### `whatsapp_sessions`
- `workspace`
- `session_name`
- `provider_status`
- `qr_code`
- `connected_phone`
- `last_synced_at`
- `last_error`

#### `knowledge_files`
- `workspace`
- upload-enabled file field managed by Payload
- `filename`
- `mime_type`
- `filesize`
- `url`
- `parse_status`
- `ingestion_status`
- `ingestion_error`
- `uploaded_at`
- `parsed_at`
- `indexed_at`

#### `knowledge_chunks`
- `workspace`
- `file`
- `chunk_index`
- `content`
- `content_hash`
- `metadata_json`

#### `conversations`
- `workspace`
- `remote_jid`
- `session_started_at`
- `last_message_at`
- `status` = `open | closed`

#### `messages`
- `workspace`
- `conversation`
- `direction`
- `provider_message_id`
- `text`
- `message_type`
- `created_at`
- `delivery_status`

#### `message_traces`
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

#### `ingestion_jobs`
- `workspace`
- `file`
- `stage` = `queued | parsing | chunking | embedding | indexed | failed`
- `attempt_count`
- `last_error`
- `started_at`
- `finished_at`

### Vector Table

`knowledge_vectors`
- `id`
- `workspace_id`
- `file_id`
- `chunk_id`
- `embedding vector(...)`
- `created_at`

Indexes:
- HNSW vector similarity index
- `workspace_id`
- `file_id`
- `chunk_id`

Migration strategy:
- `knowledge_vectors` is managed by custom Payload migrations in `src/payload/migrations/`
- similarity queries are executed through a focused SQL helper in `src/modules/knowledge/lib/knowledge-vectors.ts`

### Data Lifecycle Rules

- deleting a `knowledge_file` must delete related `knowledge_chunks`
- deleting a `knowledge_file` must delete related vector rows
- deleting a `knowledge_file` may delete related `ingestion_jobs` by policy
- deleting a `conversation` is normally retention-driven, not user-facing
- conversations, messages, and traces older than 30 days are cleaned up asynchronously
- files remain stored while account remains active in system

### Tenant Ownership Rules

`workspaces` is the tenant root entity and does not belong to another workspace.

Every other tenant-owned collection must link to `workspace`.

No tenant-owned write is valid without workspace context.

No user-facing query is valid without access enforcement and tenant scoping.

### Invariants

The following invariants must be enforced in code and validation:
- one owner per workspace in v1
- one workspace per owner in v1
- one agent per workspace in v1
- one WAHA session per workspace in v1

## WAHA Integration

### WAHA Role

WAHA is the only WhatsApp gateway in v1.

Responsibilities:
- create and manage one session per workspace
- expose QR code for linking store number
- send inbound webhook events to main app
- send outbound text messages
- surface session state changes

### Session Naming Convention

Every workspace maps to exactly one WAHA session:

```text
workspace_${workspaceId}
```

### Required WAHA Capabilities

- create session
- fetch QR code
- refresh QR code
- disconnect session
- inspect session status
- send text message
- deliver inbound text webhook to main app

### Main App Expectations

The main app must:
- provision a WAHA session if missing
- map WAHA session to workspace
- validate inbound webhook authenticity
- respond `200 OK` fast
- publish a QStash job for message processing
- persist session state updates

### Webhook Validation

Use:
- HMAC signature verification
- IP allowlist

Invalid requests are rejected before any lookup or message processing.

### Workspace Status Gate

Before AI execution:
- load workspace by WAHA session name
- check `workspace.status`

If status is:
- `active` → continue normally
- `paused` or `disabled` → skip AI and send fixed unavailability reply

### Built-in Locale-Aware System Replies

These replies are hardcoded system constants in v1 and are not editable in the dashboard.

Example key set:
- `UNAVAILABLE_REPLY`
- `TEXT_ONLY_REPLY`
- `SAFE_FALLBACK_REPLY`

Initial locales:
- `ar`
- `en`

## Knowledge Ingestion Pipeline

### Goals

Convert uploaded PDF or CSV files into searchable knowledge without blocking the request cycle.

### Pipeline Stages

1. Customer submits file through dashboard Server Action
2. Payload stores the file in Cloudflare R2 through the upload-enabled `knowledge_files` collection
3. `knowledge_files` row created
4. `ingestion_jobs` row created
5. QStash publishes `ingest-parse`
6. `ingest-parse` calls LlamaParse and stores normalized parse output / parse status
7. `ingest-parse` publishes `ingest-chunk`
8. `ingest-chunk` applies the approved chunking defaults and stores `knowledge_chunks`
9. `ingest-chunk` publishes `ingest-embed`
10. `ingest-embed` generates embeddings with OpenAI
11. `ingest-embed` stores vectors in `knowledge_vectors`
12. Mark file as indexed
13. Update workspace `last_knowledge_update_at`

### Upload Constraints

- accepted types: PDF, CSV
- file size max: 5 MB
- treat all files as unstructured knowledge in v1
- no strict CSV schema in v1

### Chunking Defaults

Use these defaults unless later testing proves retrieval quality problems:
- source: LlamaParse markdown/text output
- method: heading-aware and paragraph-aware chunking
- target chunk size: 600 tokens
- overlap: 80 tokens
- preserve heading context with the chunk whenever possible
- never split a table row
- for table-like or CSV-like content, chunk by logical row groups while preserving header context

### Retry Model

A failed ingestion job can be retried manually from customer UI or admin flow.

Retry must:
- increment `attempt_count`
- restart from the correct failed stage (`parse`, `chunk`, or `embed`)
- overwrite failed status path correctly
- avoid duplicate chunk/vector rows for same final file version

### Delete Cleanup Rules

When a file is deleted:
- delete vector rows first or transactionally with chunk cleanup
- delete `knowledge_chunks`
- delete optional ingestion history according to policy
- let Payload remove the physical file from R2 through the storage adapter
- update workspace freshness state if needed

### Customer Visibility

Customer dashboard must show per file:
- uploaded
- parsing
- indexing
- indexed
- failed

It must also show:
- last knowledge update timestamp
- retry action for failed jobs

## AI Reply Pipeline

### Goals

Produce conservative, source-grounded replies for inbound text messages without hallucinating price, stock, or policy details.

### Primary Runtime Pattern

The webhook route is not the AI runtime.

The primary runtime flow is:
1. WAHA sends inbound webhook
2. Main app validates request
3. Main app persists a minimal inbound record / idempotency marker
4. Main app returns `200 OK` immediately
5. Main app publishes a QStash job
6. Job consumer route performs workspace lookup, retrieval, LLM generation, tracing, and WAHA reply

### End-to-End Message Processing Flow

1. QStash job consumer receives message-processing payload
2. Resolve workspace by WAHA session
3. Check workspace status
4. If paused/disabled → send locale-aware unavailability reply
5. If unsupported message type → send locale-aware text-only reply
6. Resolve conversation using remote JID and 24h logic
7. Load latest 10 messages for session context
8. Run vector retrieval for top 3 chunks
9. Evaluate chunk quality / possible conflicts
10. Compose prompt from:
   - system prompt
   - quick instructions
   - latest 10 messages
   - top 3 retrieved chunks
11. Call OpenAI `generateText`
12. Validate result against fallback rules if necessary
13. Persist outbound message
14. Persist message trace
15. Send outbound text via WAHA

### Fallback Rules

Use fallback if:
- no relevant chunk found
- relevant chunk is too weak or ambiguous
- price/stock is not explicitly stated
- conflicting information appears in same file or retrieval context
- user asks outside supported product scope

### Agent Response Scope

Allowed response domains only:
- products
- prices
- stock availability when explicit
- store policies
- shipping
- working hours

### Session Logic

Conversation session resets after 24 hours of inactivity.

This means:
- old thread may remain in history
- new inbound message after 24h starts a new conversation session window

### Trace Requirements

For every AI-handled inbound message, store:
- inbound message id
- outbound message id
- retrieved chunks snapshot
- prompt snapshot
- model name
- fallback usage
- send result
- error if any

### Idempotency Rules

Duplicate inbound webhook delivery must not create:
- duplicate conversation transitions
- duplicate outbound replies
- duplicate traces

## API Endpoints

### Rule

This project does **not** expose a full internal REST API for the customer dashboard in v1.

Dashboard reads happen in Server Components.
Dashboard mutations happen in Server Actions.

Route Handlers are reserved for external or machine-to-machine flows only.

### Public / External Route Handlers

#### Health
- `GET /api/health`
- `GET /api/health/ready`

#### WAHA
- `POST /api/webhooks/waha`

#### QStash Jobs
- `POST /api/jobs/ingest-parse`
- `POST /api/jobs/ingest-chunk`
- `POST /api/jobs/ingest-embed`
- `POST /api/jobs/delete-file-artifacts`
- `POST /api/jobs/cleanup-retention`
- `POST /api/jobs/process-inbound-message`

### Customer Dashboard Interaction Pattern

Not REST endpoints:
- login form submission → Server Action
- logout → Server Action
- update agent settings → Server Action
- upload knowledge file → Server Action
- delete knowledge file → Server Action
- retry knowledge file → Server Action
- provision WhatsApp session → Server Action
- refresh WhatsApp QR → Server Action
- disconnect WhatsApp session → Server Action

Dashboard read examples:
- workspace summary → Server Component
- agent settings page → Server Component
- file list / statuses → Server Component
- WhatsApp connection state → Server Component
- conversations list/detail → Server Component

### Access Expectations

Route handlers must:
- validate origin and secret/signature as appropriate
- never expose provider secrets
- be inaccessible to browser-only user flows unless explicitly intended

Server Actions must:
- verify owner session
- resolve workspace safely
- pass `tenantId` from verified session
- use modules for all business logic

## Frontend Structure

### Customer Pages

Required pages:
- login
- dashboard
- agent settings
- knowledge uploads
- WhatsApp connection
- conversations list
- conversation detail

### Authoritative Project Tree

```text
project-root/
├── .specify/
│   ├── memory/
│   │   ├── constitution.md
│   │   └── standards/
│   │       ├── feature-template.md
│   │       └── module-template.md
│   ├── templates/
│   └── presets/
├── docs/
│   ├── onboarding-checklist.md
│   ├── rag-pipeline.md
│   ├── retention-policy.md
│   └── waha-deployment.md
├── ops/
│   └── waha/
│       ├── docker-compose.yml
│       └── nginx.conf
├── public/
│   ├── icons/
│   └── images/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (payload)/
│   │   │   └── admin/
│   │   │       └── [[...segments]]/
│   │   │           └── page.tsx
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── agent/
│   │   │   │   └── page.tsx
│   │   │   ├── knowledge/
│   │   │   │   └── page.tsx
│   │   │   ├── whatsapp/
│   │   │   │   └── page.tsx
│   │   │   └── conversations/
│   │   │       ├── page.tsx
│   │   │       └── [conversationId]/
│   │   │           └── page.tsx
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   ├── route.ts
│   │   │   │   └── ready/
│   │   │   │       └── route.ts
│   │   │   ├── webhooks/
│   │   │   │   └── waha/
│   │   │   │       └── route.ts
│   │   │   └── jobs/
│   │   │       ├── ingest-parse/
│   │   │       │   └── route.ts
│   │   │       ├── ingest-chunk/
│   │   │       │   └── route.ts
│   │   │       ├── ingest-embed/
│   │   │       │   └── route.ts
│   │   │       ├── delete-file-artifacts/
│   │   │       │   └── route.ts
│   │   │       ├── cleanup-retention/
│   │   │       │   └── route.ts
│   │   │       └── process-inbound-message/
│   │   │           └── route.ts
│   │   └── providers.tsx
│   ├── widgets/
│   │   ├── dashboard-shell/
│   │   │   ├── index.ts
│   │   │   ├── DashboardShell.tsx
│   │   │   └── _components/
│   │   │       ├── DashboardContent.tsx
│   │   │       └── DashboardSidebarSlot.tsx
│   │   ├── page-header/
│   │   │   ├── index.ts
│   │   │   └── PageHeader.tsx
│   │   ├── sidebar/
│   │   │   ├── index.ts
│   │   │   ├── Sidebar.tsx
│   │   │   └── _components/
│   │   │       ├── SidebarItem.tsx
│   │   │       └── SidebarWorkspaceBadge.tsx
│   │   └── topbar/
│   │       ├── index.ts
│   │       ├── Topbar.tsx
│   │       └── _components/
│   │           ├── TopbarStatusPill.tsx
│   │           └── TopbarUserMenu.tsx
│   ├── features/
│   │   ├── _registry/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── auth-login/
│   │   │   ├── README.md
│   │   │   ├── feature.config.ts
│   │   │   ├── index.ts
│   │   │   ├── ui/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── _components/
│   │   │   │       └── LoginForm.tsx
│   │   │   ├── actions/
│   │   │   │   ├── login.action.ts
│   │   │   │   └── logout.action.ts
│   │   │   ├── logic/
│   │   │   │   └── auth-login.service.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── dashboard-summary/
│   │   │   ├── README.md
│   │   │   ├── feature.config.ts
│   │   │   ├── index.ts
│   │   │   ├── ui/
│   │   │   │   ├── DashboardSummaryPage.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── DashboardMetricCard.tsx
│   │   │   │       ├── KnowledgeFreshnessCard.tsx
│   │   │   │       └── WorkspaceStatusCard.tsx
│   │   │   ├── actions/
│   │   │   ├── logic/
│   │   │   │   └── dashboard-summary.service.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── agent-settings/
│   │   │   ├── README.md
│   │   │   ├── feature.config.ts
│   │   │   ├── index.ts
│   │   │   ├── ui/
│   │   │   │   ├── AgentSettingsPage.tsx
│   │   │   │   └── _components/
│   │   │   │       └── AgentSettingsForm.tsx
│   │   │   ├── actions/
│   │   │   │   └── update-agent.action.ts
│   │   │   ├── logic/
│   │   │   │   └── agent-settings.service.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── knowledge-uploads/
│   │   │   ├── README.md
│   │   │   ├── feature.config.ts
│   │   │   ├── index.ts
│   │   │   ├── ui/
│   │   │   │   ├── KnowledgeUploadsPage.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── KnowledgeFileList.tsx
│   │   │   │       ├── KnowledgeFileRow.tsx
│   │   │   │       └── KnowledgeUploadForm.tsx
│   │   │   ├── actions/
│   │   │   │   ├── upload-knowledge-file.action.ts
│   │   │   │   ├── delete-knowledge-file.action.ts
│   │   │   │   └── retry-knowledge-file.action.ts
│   │   │   ├── logic/
│   │   │   │   └── knowledge-uploads.service.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── whatsapp-connection/
│   │   │   ├── README.md
│   │   │   ├── feature.config.ts
│   │   │   ├── index.ts
│   │   │   ├── ui/
│   │   │   │   ├── WhatsAppConnectionPage.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── WhatsAppQrCard.tsx
│   │   │   │       └── WhatsAppSessionStatus.tsx
│   │   │   ├── actions/
│   │   │   │   ├── provision-whatsapp-session.action.ts
│   │   │   │   ├── refresh-whatsapp-qr.action.ts
│   │   │   │   └── disconnect-whatsapp-session.action.ts
│   │   │   ├── logic/
│   │   │   │   └── whatsapp-connection.service.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   └── conversations-viewer/
│   │       ├── README.md
│   │       ├── feature.config.ts
│   │       ├── index.ts
│   │       ├── ui/
│   │       │   ├── ConversationsViewerPage.tsx
│   │       │   └── _components/
│   │       │       ├── ConversationList.tsx
│   │       │       ├── ConversationListItem.tsx
│   │       │       ├── ConversationMessageList.tsx
│   │       │       └── ConversationMessageBubble.tsx
│   │       ├── actions/
│   │       ├── logic/
│   │       │   └── conversations-viewer.service.ts
│   │       ├── types.ts
│   │       ├── constants.ts
│   │       └── tests/
│   │           ├── unit/
│   │           └── integration/
│   ├── modules/
│   │   ├── agents/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── agents.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-agent-settings.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── ai-agent/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── ai-agent.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-ai-request.ts
│   │   │   ├── lib/
│   │   │   │   └── prompt-composer.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── conversations/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── conversations.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-conversation.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── ingestion-jobs/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── ingestion-jobs.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-ingestion-job.ts
│   │   │   ├── lib/
│   │   │   │   └── qstash-payload.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── knowledge/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── knowledge.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-knowledge-file.ts
│   │   │   ├── lib/
│   │   │   │   ├── chunk-text.ts
│   │   │   │   ├── knowledge-vectors.ts
│   │   │   │   └── parse-normalized-document.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── tracing/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── tracing.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-message-trace.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   ├── whatsapp/
│   │   │   ├── README.md
│   │   │   ├── index.ts
│   │   │   ├── services/
│   │   │   │   └── whatsapp.service.ts
│   │   │   ├── validators/
│   │   │   │   └── validate-waha-webhook.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── integration/
│   │   └── workspaces/
│   │       ├── README.md
│   │       ├── index.ts
│   │       ├── services/
│   │       │   └── workspaces.service.ts
│   │       ├── validators/
│   │       │   └── validate-workspace-status.ts
│   │       ├── types.ts
│   │       ├── constants.ts
│   │       └── tests/
│   │           ├── unit/
│   │           └── integration/
│   ├── payload/
│   │   ├── payload.config.ts
│   │   ├── lib/
│   │   │   ├── get-payload.ts
│   │   │   └── with-tenant-context.ts
│   │   ├── access/
│   │   │   ├── is-admin.access.ts
│   │   │   ├── is-owner.access.ts
│   │   │   ├── same-workspace.access.ts
│   │   │   ├── workspace-scope.access.ts
│   │   │   └── traces-admin-only.access.ts
│   │   ├── admin/
│   │   │   └── workspace-status-cell.tsx
│   │   ├── collections/
│   │   │   ├── index.ts
│   │   │   ├── users.collection.ts
│   │   │   ├── workspaces.collection.ts
│   │   │   ├── agents.collection.ts
│   │   │   ├── whatsapp-sessions.collection.ts
│   │   │   ├── knowledge-files.collection.ts
│   │   │   ├── knowledge-chunks.collection.ts
│   │   │   ├── conversations.collection.ts
│   │   │   ├── messages.collection.ts
│   │   │   ├── message-traces.collection.ts
│   │   │   └── ingestion-jobs.collection.ts
│   │   ├── globals/
│   │   ├── hooks/
│   │   │   ├── knowledge-file-after-delete.hook.ts
│   │   │   ├── knowledge-file-before-change.hook.ts
│   │   │   ├── workspace-before-delete.hook.ts
│   │   │   └── message-trace-before-read.hook.ts
│   │   └── migrations/
│   ├── core/
│   │   ├── env.ts
│   │   ├── auth/
│   │   │   ├── dal.ts
│   │   │   ├── get-session.ts
│   │   │   ├── require-owner-session.ts
│   │   │   ├── session-cookie.ts
│   │   │   └── verify-workspace-session.ts
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   └── error-codes.ts
│   │   ├── logger/
│   │   │   ├── index.ts
│   │   │   └── logger.ts
│   │   ├── providers/
│   │   │   ├── llama-parse-client.ts
│   │   │   ├── openai-client.ts
│   │   │   ├── qstash-client.ts
│   │   │   └── waha-client.ts
│   │   └── queue/
│   │       ├── enqueue-delete-file-artifacts.ts
│   │       ├── enqueue-ingest-parse.ts
│   │       ├── enqueue-ingest-chunk.ts
│   │       ├── enqueue-ingest-embed.ts
│   │       ├── enqueue-process-inbound-message.ts
│   │       └── enqueue-retention-cleanup.ts
│   ├── shared/
│   │   ├── lib/
│   │   │   ├── format-date.ts
│   │   │   ├── invariant.ts
│   │   │   ├── locale-from-text.ts
│   │   │   └── safe-json.ts
│   │   ├── types/
│   │   │   ├── action-result.ts
│   │   │   ├── api-error.ts
│   │   │   └── workspace-status.ts
│   │   └── ui/
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── empty-state.tsx
│   │       ├── input.tsx
│   │       ├── loading-state.tsx
│   │       └── textarea.tsx
│   └── payload-types.ts
├── tests/
│   ├── e2e/
│   │   ├── auth-login.spec.ts
│   │   ├── knowledge-upload.spec.ts
│   │   ├── whatsapp-session.spec.ts
│   │   └── workspace-status-gate.spec.ts
│   ├── integration/
│   │   ├── webhooks/
│   │   │   └── waha-webhook.integration.test.ts
│   │   ├── jobs/
│   │   │   ├── cleanup-retention.integration.test.ts
│   │   │   ├── ingest-parse.integration.test.ts
│   │   │   ├── ingest-chunk.integration.test.ts
│   │   │   ├── ingest-embed.integration.test.ts
│   │   │   └── process-inbound-message.integration.test.ts
│   │   └── payload/
│   │       └── tenant-access.integration.test.ts
│   └── unit/
│       ├── modules/
│       └── shared/
├── .env.example
├── .gitignore
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── README.md
├── tsconfig.json
├── vitest.config.ts
└── proxy.ts
```

### Feature and Module Internal Structure Rules

The project tree above is the top-level map. Every feature and module listed there must expand using the approved standards.

#### Every feature folder must expand like this

```text
src/features/[feature-name]/
├── README.md
├── feature.config.ts
├── index.ts
├── ui/
│   ├── [MainComponent].tsx
│   └── _components/
│       └── [SubComponent].tsx
├── actions/
│   └── [verb-noun].action.ts
├── logic/
│   ├── use-[feature].ts
│   └── [feature].service.ts
├── types.ts
├── constants.ts
└── tests/
    ├── unit/
    └── integration/
```

#### Every module folder must expand like this

```text
src/modules/[module-name]/
├── README.md
├── index.ts
├── services/
│   └── [module].service.ts
├── validators/
│   └── validate-[entity].ts
├── lib/
│   └── [external-api].client.ts
├── types.ts
└── constants.ts
```

The `lib/` folder inside a module is optional and should be used only when the module needs small provider-specific helpers or clients. It is not a mandatory repository layer.

### UI Responsibilities

#### Login
- customer owner sign-in only

#### Dashboard
Shows:
- workspace status
- WhatsApp connection status
- message counts
- last knowledge update
- file ingestion summary

#### Agent Settings
Allows editing:
- display name
- response style
- system prompt
- quick instructions
- language preference if needed

#### Knowledge Uploads
Allows:
- upload PDF / CSV
- view file status
- retry failed ingestion
- delete file
- see last knowledge update

#### WhatsApp Connection
Allows:
- provision WAHA session
- fetch QR code
- refresh QR code
- disconnect session
- inspect current connection state

#### Conversations
View only:
- list conversations
- inspect messages inside one conversation
- no ticketing, labels, or staff workflows in v1
- no trace viewer for customers in v1

## Security and Access Control

### Customer Isolation

Customers must never:
- access Payload Admin Panel
- read another workspace
- mutate another workspace
- access message traces or admin-only internal information in v1

### Access Model

Use:
- Payload multi-tenant plugin for tenant-aware collections
- collection/global/field access rules
- owner session verification for customer pages and server actions
- `overrideAccess: false` on sensitive user-facing Local API operations

### Sensitive Local API Rule

Any user-facing local Payload operation that touches tenant data must explicitly avoid bypassing access control.

### Webhook Security

WAHA webhooks must validate:
- caller IP allowlist
- HMAC signature

### Job Security

QStash job routes must validate signed requests.

### Data Exposure Rules

Browser-facing responses must never include:
- provider API keys
- raw secrets
- admin-only internal debugging unless intentionally scoped

### Observability Rules

Every inbound message must be traceable.

Persist or make available:
- inbound message
- outbound reply
- retrieved chunks
- prompt snapshot
- final outcome
- error or fallback reason

## Deployment and Infrastructure

### Main Application

Deploy to Vercel:
- Next.js customer dashboard
- Payload Admin
- route handlers
- server-side modules
- API routes

### WAHA Infrastructure

Deploy WAHA separately on:
- VPS
- Railway
- Render
- or equivalent dedicated runtime

Recommended WAHA stack:
- WAHA container
- Nginx reverse proxy
- TLS termination
- persistent session storage if required by WAHA deployment model
- health monitoring

### External Services

| Service | Purpose |
|---------|---------|
| Neon | primary database |
| Cloudflare R2 | file storage |
| QStash | async orchestration |
| LlamaParse | document parsing |
| OpenAI | embeddings + final response |
| WAHA | WhatsApp gateway |

### Operational Deliverables

- Vercel project configured
- Neon database provisioned
- pgvector enabled
- R2 bucket created
- Payload upload storage configured against R2
- WAHA host deployed
- QStash configured
- QStash retention schedule configured
- LlamaParse configured
- OpenAI configured
- environment validation implemented

### Serverless Timeout Mitigation

The ingestion pipeline is deliberately split into chained QStash jobs to reduce Vercel timeout risk:
- `ingest-parse`
- `ingest-chunk`
- `ingest-embed`

QStash consumer routes process synchronously and return 2xx only on success so QStash can retry failed stages automatically.

### Recommended Non-Goals for v1 Ops

- no Kubernetes
- no separate worker fleet
- no multi-region complexity
- no event bus
- no distributed tracing stack unless later required

---

## Build Order

### Phase 1: Foundation

| Task | Description |
|------|-------------|
| 1.1 | Create repo structure matching constitution (`src/app`, `features`, `modules`, `payload`, `core`, `shared`) |
| 1.2 | Initialize Next.js 16.2.x project with TypeScript strict mode |
| 1.3 | Install and configure Payload CMS 3.79.1 inside same codebase |
| 1.4 | Connect Neon PostgreSQL |
| 1.5 | Enable `pgvector` and create vector migration scaffolding |
| 1.6 | Configure Payload upload storage with `@payloadcms/storage-s3` against Cloudflare R2 |
| 1.7 | Add environment validation layer |
| 1.8 | Add Payload multi-tenant plugin configured with `tenantsSlug: 'workspaces'` |
| 1.9 | Enable Payload built-in auth on `users` and add `src/core/auth/` wrappers |
| 1.10 | Add health endpoints and job route scaffolding |
| 1.11 | Add test, lint, and typecheck baseline |
| 1.12 | Add project constitution and standards files |

**Checkpoint**: App runs locally, Payload Admin works, customer auth skeleton works, Neon is connected, and env validation is enforced.

### Phase 2: Database Setup

| Task | Description |
|------|-------------|
| 2.1 | Create `workspaces` collection and use it as the plugin tenant collection slug |
| 2.2 | Create `agents` collection |
| 2.3 | Create `whatsapp_sessions` collection |
| 2.4 | Create `knowledge_files` collection |
| 2.5 | Create `knowledge_chunks` collection |
| 2.6 | Create `conversations` collection |
| 2.7 | Create `messages` collection |
| 2.8 | Create `message_traces` collection |
| 2.9 | Create `ingestion_jobs` collection |
| 2.10 | Create SQL vector table and indexes |
| 2.11 | Add access control functions for all tenant collections |
| 2.12 | Add collection hooks for tenant safety and lifecycle rules |
| 2.13 | Enforce one-owner / one-workspace / one-agent / one-session invariants, including a single plugin-managed tenant entry for owners |
| 2.14 | Add retention cleanup scaffolding |
| 2.15 | Add dev seed/bootstrap scripts |

**Checkpoint**: Data model is stable, tenant scoping is implemented, and all core collections exist.

### Phase 3: WAHA and Workspace Status

| Task | Description |
|------|-------------|
| 3.1 | Create WAHA module and WAHA provider client |
| 3.2 | Create session provisioning service |
| 3.3 | Create QR fetch service |
| 3.4 | Build WhatsApp Connection feature with Server Actions |
| 3.5 | Create WAHA HMAC verification + IP allowlist validation |
| 3.6 | Create workspace lookup by session name |
| 3.7 | Create workspace status gate service |
| 3.8 | Add locale-aware paused/disabled reply path |
| 3.9 | Persist WAHA session state updates |
| 3.10 | Add customer dashboard connection summary widgets |

**Checkpoint**: Customer can provision a WAHA session, see QR, connect the store number, and workspace pause/disable is enforceable.

### Phase 4: Knowledge Ingestion

| Task | Description |
|------|-------------|
| 4.1 | Build file upload Server Action using the Payload upload-enabled `knowledge_files` collection |
| 4.2 | Build Knowledge Uploads feature reads through Server Components |
| 4.3 | Create QStash publish flow for `ingest-parse` |
| 4.4 | Create `ingest-parse` job route and integrate LlamaParse |
| 4.5 | Normalize parsed output and publish `ingest-chunk` |
| 4.6 | Create `ingest-chunk` job route |
| 4.7 | Build approved chunking pipeline (600 / 80, heading-aware, row-safe) |
| 4.8 | Insert chunks into database and publish `ingest-embed` |
| 4.9 | Create `ingest-embed` job route |
| 4.10 | Generate embeddings with OpenAI and insert vectors into pgvector table |
| 4.11 | Add ingestion status and stage-aware retry logic |
| 4.12 | Add file deletion cleanup for chunks/vectors |
| 4.13 | Expose last knowledge update to dashboard |

**Checkpoint**: Customer can upload files and see them move from uploaded → parsing → indexed with retry support.

### Phase 5: AI Runtime and Messaging

| Task | Description |
|------|-------------|
| 5.1 | Create inbound WAHA webhook route |
| 5.2 | Persist inbound idempotency marker and publish QStash processing job |
| 5.3 | Add unsupported message type path |
| 5.4 | Create conversation resolver and 24h session logic |
| 5.5 | Create latest 10 messages retrieval |
| 5.6 | Create vector retrieval service (top 3 chunks) |
| 5.7 | Create conflict / freshness evaluation logic |
| 5.8 | Create prompt composer |
| 5.9 | Integrate OpenAI `generateText` |
| 5.10 | Persist outbound messages |
| 5.11 | Persist message traces |
| 5.12 | Send outbound text through WAHA |
| 5.13 | Add failure capture and fallback handling |

**Checkpoint**: An inbound WhatsApp text can travel end-to-end from WAHA → webhook → QStash → retrieval → LLM → WAHA reply.

### Phase 6: Customer Dashboard

| Task | Description |
|------|-------------|
| 6.1 | Build login page and auth-login feature |
| 6.2 | Build dashboard shell and protected layout |
| 6.3 | Build dashboard summary cards using Server Components |
| 6.4 | Build Agent Settings feature with Server Actions |
| 6.5 | Build Knowledge Uploads feature with Server Actions |
| 6.6 | Build WhatsApp Connection feature with Server Actions |
| 6.7 | Build Conversations list |
| 6.8 | Build Conversation detail viewer |
| 6.9 | Build workspace status banner and empty states |
| 6.10 | Add loading, empty, and error states |
| 6.11 | Add customer-safe notifications and alerts |

**Checkpoint**: Customer can fully operate the product through custom dashboard without ever touching Payload Admin.

### Phase 7: Hardening

| Task | Description |
|------|-------------|
| 7.1 | Add automated tests for tenant access enforcement |
| 7.2 | Add tests for workspace status gate |
| 7.3 | Add tests for unsupported message types |
| 7.4 | Add tests for duplicate webhook idempotency |
| 7.5 | Add tests for fallback on missing/conflicting knowledge |
| 7.6 | Add tests for file delete cleanup |
| 7.7 | Add tests for 24h session reset logic |
| 7.8 | Add observability polish and structured logs |
| 7.9 | Finalize manual onboarding checklist |
| 7.10 | Run definition-of-done verification |

**Checkpoint**: Ready for first real stores with stable onboarding, predictable failure behavior, and security-critical tests.

## Environment Variables

### Main App (`.env` / Vercel project settings)

```bash
# App
NODE_ENV=development
APP_URL=http://localhost:3000
PAYLOAD_SECRET=replace_me

# Database
DATABASE_URL=postgres://...
NEON_DATABASE_URL=postgres://...

# Storage (Cloudflare R2 via storage-s3)
R2_ENDPOINT=
R2_REGION=auto
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=

# OpenAI
OPENAI_API_KEY=

# LlamaParse
LLAMA_PARSE_API_KEY=

# QStash
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# WAHA
WAHA_BASE_URL=
WAHA_ADMIN_API_KEY=
WAHA_WEBHOOK_HMAC_SECRET=
WAHA_ALLOWED_IPS=127.0.0.1,10.0.0.1

# Feature flags / ops
ENABLE_WAHA_SANDBOX=false
RETENTION_DAYS=30
MAX_UPLOAD_MB=5
```

### Production Notes

- `PAYLOAD_SECRET` must be long and unique.
- `DATABASE_URL` must be server-side only.
- R2 credentials must never be exposed to browser code.
- `WAHA_ADMIN_API_KEY` and `WAHA_WEBHOOK_HMAC_SECRET` are server-only.
- `QSTASH_*` values are server-only.
- `OPENAI_API_KEY` and `LLAMA_PARSE_API_KEY` are server-only.

### WAHA Host (`docker-compose` or host env)

```bash
WHATSAPP_DEFAULT_ENGINE=GOWS
WAHA_API_KEY=replace_me
WAHA_BASE_URL=https://waha.example.com
```

Additional WAHA/Nginx configuration is expected but should remain outside the main Vercel app repository unless intentionally versioned in `/ops`.

---

## Verification Checklist

### Definition of Done (per major capability)

- [ ] Admin can create a customer owner and workspace
- [ ] Customer can log into dashboard
- [ ] Customer can edit agent settings
- [ ] Customer can upload PDF
- [ ] Customer can upload CSV
- [ ] Uploaded file is stored in R2
- [ ] File parsing runs asynchronously
- [ ] Chunks and vectors are generated
- [ ] Customer can see file status
- [ ] Customer can see last knowledge update
- [ ] Customer can provision WAHA session
- [ ] Customer can scan QR and connect WhatsApp
- [ ] Inbound text message produces outbound reply
- [ ] Unsupported message type produces text-only reply
- [ ] Paused or disabled workspace produces static reply without LLM call
- [ ] Conversations visible in dashboard
- [ ] Payload Admin is not exposed to customers

### Data Integrity Verification

- [ ] One workspace per customer owner in v1
- [ ] One agent per workspace in v1
- [ ] One WAHA session per workspace
- [ ] One workspace status value per workspace
- [ ] Every tenant-owned record links to workspace
- [ ] Chunk rows map back to one file
- [ ] Vector rows map back to one chunk
- [ ] File deletion removes chunks and vectors
- [ ] Conversation timestamps update correctly
- [ ] Retention cleanup removes 30-day-old conversations/messages/traces

### Security Verification

- [ ] Customer cannot read another workspace
- [ ] Customer cannot edit another workspace's agent
- [ ] Customer cannot see admin-only traces
- [ ] Local API sensitive paths use `overrideAccess: false`
- [ ] WAHA webhook rejects invalid HMAC signature
- [ ] Duplicate webhook does not produce duplicate reply
- [ ] No provider secret appears in browser or API response
- [ ] Paused or disabled workspace cannot trigger AI execution

### AI Safety Verification

- [ ] No explicit source for price → fallback
- [ ] No explicit source for stock → fallback
- [ ] Conflicting info in same file → fallback
- [ ] Missing relevant chunks → fallback
- [ ] Out-of-scope request → fallback
- [ ] Reply stays within products/policies/shipping/hours scope

### Operational Verification

- [ ] WAHA health visible in dashboard/admin
- [ ] Failed ingestion visible in customer UI
- [ ] Failed outbound send visible in trace/admin
- [ ] Health endpoints work
- [ ] Main app builds on Vercel
- [ ] WAHA deployment runbook exists

---

## Files to Create

The authoritative source for file and folder creation is the **Authoritative Project Tree** above.

The minimum initial implementation must create every path listed there that is required for:
- app boot
- Payload boot
- tenant-safe auth
- WAHA session lifecycle
- knowledge upload and ingestion
- AI reply handling
- customer dashboard rendering
- testing and operations

### Critical Root Files

```text
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

### Critical Infrastructure Files

```text
src/core/env.ts
src/core/auth/dal.ts
src/payload/payload.config.ts
src/payload/lib/get-payload.ts
src/payload/lib/with-tenant-context.ts
src/payload-types.ts
src/app/layout.tsx
src/app/(payload)/admin/[[...segments]]/page.tsx
ops/waha/docker-compose.yml
ops/waha/nginx.conf
```

### Critical Payload Files

```text
src/payload/collections/index.ts
src/payload/collections/users.collection.ts
src/payload/collections/workspaces.collection.ts
src/payload/collections/agents.collection.ts
src/payload/collections/whatsapp-sessions.collection.ts
src/payload/collections/knowledge-files.collection.ts
src/payload/collections/knowledge-chunks.collection.ts
src/payload/collections/conversations.collection.ts
src/payload/collections/messages.collection.ts
src/payload/collections/message-traces.collection.ts
src/payload/collections/ingestion-jobs.collection.ts

src/payload/access/is-admin.access.ts
src/payload/access/is-owner.access.ts
src/payload/access/same-workspace.access.ts
src/payload/access/workspace-scope.access.ts
src/payload/access/traces-admin-only.access.ts
```

### Critical Route Handlers

```text
src/app/api/health/route.ts
src/app/api/health/ready/route.ts
src/app/api/webhooks/waha/route.ts
src/app/api/jobs/ingest-parse/route.ts
src/app/api/jobs/ingest-chunk/route.ts
src/app/api/jobs/ingest-embed/route.ts
src/app/api/jobs/delete-file-artifacts/route.ts
src/app/api/jobs/cleanup-retention/route.ts
src/app/api/jobs/process-inbound-message/route.ts
```

### Critical Customer Pages

```text
src/app/(auth)/login/page.tsx
src/app/(dashboard)/layout.tsx
src/app/(dashboard)/dashboard/page.tsx
src/app/(dashboard)/agent/page.tsx
src/app/(dashboard)/knowledge/page.tsx
src/app/(dashboard)/whatsapp/page.tsx
src/app/(dashboard)/conversations/page.tsx
src/app/(dashboard)/conversations/[conversationId]/page.tsx
```

### Critical Feature Folders

```text
src/features/auth-login/
src/features/dashboard-summary/
src/features/agent-settings/
src/features/knowledge-uploads/
src/features/whatsapp-connection/
src/features/conversations-viewer/
```

### Critical Module Folders

```text
src/modules/workspaces/
src/modules/agents/
src/modules/whatsapp/
src/modules/knowledge/
src/modules/conversations/
src/modules/ai-agent/
src/modules/tracing/
src/modules/ingestion-jobs/
```

Every feature and module must expand using the approved standards templates. No shortcuts.

## Appendix: Build-Phase Extraction Note

This document preserves the approved 7-phase build order.

Specification extraction is intentionally **not** part of this implementation plan revision.
A separate agent may later derive one specification from each build phase.

For this document, the only requirement is:
- keep the build order exactly as written
- do not restructure the plan around spec-count discussions
- keep each phase implementation-ready and internally coherent

## Appendix: Deferred Items (Not in v1)

These items are intentionally deferred and must not leak into the MVP:

- public signup
- Stripe or automated billing
- staff roles
- multiple agents per workspace
- multiple workspaces per owner
- live product/inventory APIs
- human handoff workflows
- ticket creation
- image/audio understanding
- AI SDK 6 beta agent runtime
- MCP tools in production runtime
- ToolLoopAgent flows
- advanced analytics
- auto-QA evaluation pipeline
