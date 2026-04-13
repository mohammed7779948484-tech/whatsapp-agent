# Data Model: Database Setup

**Branch**: `002-database-setup` | **Date**: 2026-04-04
**Input**: spec.md entities and research.md decisions

---

## Entity Relationship Overview

```text
users (existing)
  └── tenants[] → workspaces (plugin-managed, max 1 for owners)

workspaces (existing, extended)
  ├── owner → users
  ├── agents (1:1)
  ├── whatsapp_sessions (1:1)
  ├── knowledge_files (1:many)
  ├── conversations (1:many)
  ├── ingestion_jobs (1:many)
  └── last_knowledge_update_at

agents
  └── workspace → workspaces

whatsapp_sessions
  └── workspace → workspaces

knowledge_files
  ├── workspace → workspaces
  ├── knowledge_chunks (1:many, cascade delete)
  └── knowledge_vectors (1:many, cascade delete via SQL)

knowledge_chunks
  ├── workspace → workspaces
  └── file → knowledge_files

conversations
  ├── workspace → workspaces
  └── messages (1:many)

messages
  ├── workspace → workspaces
  └── conversation → conversations

message_traces
  ├── workspace → workspaces
  ├── conversation → conversations
  ├── inbound_message → messages
  └── outbound_message → messages

ingestion_jobs
  ├── workspace → workspaces
  └── file → knowledge_files

knowledge_vectors (SQL table, not Payload collection)
  ├── workspace_id → workspaces.id
  ├── file_id → knowledge_files.id
  └── chunk_id → knowledge_chunks.id
```

---

## Entity Definitions

### workspaces (EXTEND existing)

New fields to add to the existing collection:

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `owner` | relationship → users | false | — | References the owner user. Not required at creation (admin creates workspace first, then assigns owner). |
| `last_knowledge_update_at` | date | false | — | Timestamp of most recent successfully indexed knowledge file. Updated by ingestion pipeline. |

Existing fields unchanged: `name`, `slug`, `status`.

---

### agents (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link. One agent per workspace (enforced by hook). |
| `display_name` | text | true | — | Customer-visible agent name. |
| `response_style` | textarea | false | — | Describes the agent's tone and personality. |
| `system_prompt` | textarea | false | — | Full system prompt for AI generation context. |
| `quick_instructions` | textarea | false | — | Short operational instructions appended to prompt. |
| `language_preference` | select | false | — | Options: `ar`, `en`. Used for locale-aware replies. |
| `is_enabled` | checkbox | true | true | Whether the agent is active. |

**Invariant**: Exactly one agent per workspace. Enforced by `beforeChange` hook.

**Access control**: Admin full CRUD. Owner read/update own workspace's agent only.

---

### whatsapp_sessions (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link. One session per workspace (enforced by hook). |
| `session_name` | text | true | — | Convention: `workspace_${workspaceId}`. |
| `provider_status` | select | true | `disconnected` | Options: `connected`, `disconnected`, `qr_pending`, `error`. |
| `qr_code` | textarea | false | — | Base64 or data URI of current QR code. |
| `connected_phone` | text | false | — | Phone number after successful connection. |
| `last_synced_at` | date | false | — | Last successful WAHA heartbeat/sync. |
| `last_error` | textarea | false | — | Most recent error message from WAHA. |

**Invariant**: Exactly one session per workspace. Enforced by `beforeChange` hook.

**Access control**: Admin full CRUD. Owner read own workspace's session only.

---

### knowledge_files (NEW — upload-enabled)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link. |
| (upload field) | upload | true | — | Payload-managed. Accepted mimeTypes: `application/pdf`, `text/csv`. Max size from `env.MAX_UPLOAD_MB`. |
| `filename` | text | false | — | Original filename (may also be available via Payload upload metadata). |
| `mime_type` | text | false | — | Detected MIME type. |
| `filesize` | number | false | — | File size in bytes. |
| `parse_status` | select | true | `pending` | Options: `pending`, `parsing`, `parsed`, `failed`. |
| `ingestion_status` | select | true | `pending` | Options: `pending`, `processing`, `indexed`, `failed`. |
| `ingestion_error` | textarea | false | — | Error message if ingestion failed. |
| `uploaded_at` | date | true | now | Timestamp of original upload. |
| `parsed_at` | date | false | — | When parsing completed. |
| `indexed_at` | date | false | — | When embedding/indexing completed. |

**Lifecycle hooks**:
- `beforeChange` (create): Initialize `parse_status: 'pending'`, `ingestion_status: 'pending'`, `uploaded_at: now`.
- `afterDelete`: Cascade delete all associated `knowledge_chunks` and `knowledge_vectors` rows.

**Access control**: Admin full CRUD. Owner CRUD within own workspace.

**Upload registration**: Register `knowledge_files` in the `s3Storage` plugin's `collections` map.

---

### knowledge_chunks (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link (denormalized from file for query efficiency). |
| `file` | relationship → knowledge_files | true | — | Source file reference. |
| `chunk_index` | number | true | — | Ordering index within the source file. |
| `content` | textarea | true | — | Full chunk text content. |
| `content_hash` | text | true | — | SHA-256 hash of content for deduplication. |
| `metadata_json` | json | false | — | Arbitrary metadata (headings, page numbers, etc.). |

**Access control**: Admin full CRUD. Owner read within own workspace.

---

### conversations (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link. |
| `remote_jid` | text | true | — | WhatsApp remote JID (phone identifier). |
| `session_started_at` | date | true | — | Start of the 24h session window. |
| `last_message_at` | date | true | — | Timestamp of most recent message in session. |
| `status` | select | true | `open` | Options: `open`, `closed`. |

**Access control**: Admin full CRUD. Owner read within own workspace.

---

### messages (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link (denormalized from conversation). |
| `conversation` | relationship → conversations | true | — | Parent conversation. |
| `direction` | select | true | — | Options: `inbound`, `outbound`. |
| `provider_message_id` | text | false | — | WAHA/WhatsApp message ID for correlation. |
| `text` | textarea | true | — | Message body text. |
| `message_type` | select | true | `text` | Options: `text`, `image`, `audio`, `video`, `document`, `other`. Only `text` is processed in v1. |
| `delivery_status` | select | false | — | Options: `sent`, `delivered`, `read`, `failed`. Outbound only. |

**Access control**: Admin full CRUD. Owner read within own workspace.

Note: `created_at` is provided automatically by Payload's `timestamps: true`.

---

### message_traces (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link. |
| `conversation` | relationship → conversations | true | — | Parent conversation. |
| `inbound_message` | relationship → messages | true | — | The triggering inbound message. |
| `outbound_message` | relationship → messages | false | — | The generated outbound reply (null if fallback with no send). |
| `prompt_snapshot` | textarea | false | — | Full prompt sent to the model. |
| `retrieved_chunks_snapshot` | json | false | — | Snapshot of retrieved chunk data at time of reply. |
| `model_name` | text | false | — | e.g., `gpt-4o-mini`. |
| `used_fallback` | checkbox | true | false | Whether the fallback reply was used instead of model output. |
| `fallback_reason` | text | false | — | Why fallback was triggered. |
| `send_status` | select | false | — | Options: `sent`, `failed`. |
| `error_details` | textarea | false | — | Error information if send or generation failed. |

**Access control**: Admin read only. Owner MUST NOT read traces (FR-015).

---

### ingestion_jobs (NEW)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | relationship → workspaces | true | — | Tenant link. |
| `file` | relationship → knowledge_files | true | — | Source file being ingested. |
| `stage` | select | true | `queued` | Options: `queued`, `parsing`, `chunking`, `embedding`, `indexed`, `failed`. |
| `attempt_count` | number | true | 0 | Number of processing attempts. |
| `last_error` | textarea | false | — | Most recent error message. |
| `started_at` | date | false | — | When processing began. |
| `finished_at` | date | false | — | When processing completed or failed. |

**Access control**: Admin full CRUD. Owner read within own workspace.

---

### knowledge_vectors (SQL TABLE — not a Payload collection)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid / serial | no | Primary key. |
| `workspace_id` | integer | no | FK to workspaces. |
| `file_id` | integer | no | FK to knowledge_files. |
| `chunk_id` | integer | no | FK to knowledge_chunks. |
| `embedding` | vector(1536) | no | pgvector column. Dimension = text-embedding-3-small output. |
| `created_at` | timestamptz | no | Default: now(). |

**Indexes**:
- HNSW index on `embedding` column for similarity search (cosine distance).
- B-tree index on `workspace_id`.
- B-tree index on `file_id`.
- B-tree index on `chunk_id`.

**Migration**: Created in `src/payload/migrations/00002_create_knowledge_vectors.ts`.

---

## State Transitions

### Knowledge File Ingestion Lifecycle

```text
[upload] → parse_status: pending, ingestion_status: pending
  │
  ▼ (ingest-parse job starts)
parse_status: parsing
  │
  ├── success → parse_status: parsed
  │                │
  │                ▼ (ingest-chunk job)
  │              ingestion_status: processing
  │                │
  │                ▼ (ingest-embed job)
  │              ingestion_status: indexed ← DONE
  │
  └── failure → parse_status: failed, ingestion_status: failed
```

### Conversation Session Lifecycle

```text
[new inbound from unknown JID] → status: open, session_started_at: now
  │
  ├── messages within 24h → last_message_at updated
  │
  └── 24h inactivity → status: closed (by retention or next inbound creates new conversation)
```

### WhatsApp Session Provider Status

```text
disconnected → qr_pending → connected
     ↑              │
     └── error ←────┘
     ↑              │
     └──────────────┘ (disconnect action)
```

---

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| agents | workspace | One agent per workspace (hook-enforced) |
| whatsapp_sessions | workspace | One session per workspace (hook-enforced) |
| knowledge_files | upload | Accepted types: `application/pdf`, `text/csv` only |
| knowledge_files | upload | Max size: `env.MAX_UPLOAD_MB` (default 5 MB) |
| knowledge_chunks | content_hash | SHA-256 of content field |
| conversations | remote_jid | Required, non-empty |
| messages | direction | Must be `inbound` or `outbound` |
| ingestion_jobs | stage | Must be one of the defined stages |
| workspaces.slug | format | Lowercase alphanumeric with hyphens (`/^[a-z0-9-]+$/`) — existing validation |
