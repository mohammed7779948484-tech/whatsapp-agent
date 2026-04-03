# Data Model: Project Foundation

**Branch**: `001-project-foundation`
**Date**: 2026-04-02

## Entities

### User

Represents a person who can authenticate with the system.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | auto-generated | primary key | Payload-managed |
| email | string | required, unique, valid email format | Login credential |
| role | enum: `admin`, `owner` | required, default: `owner` | Determines access level |
| tenants | array of workspace references | plugin-managed, max 1 for owners | Added by multi-tenant plugin |
| password | string (hashed) | required, min 8 characters | Payload auth built-in |
| createdAt | timestamp | auto | Payload-managed |
| updatedAt | timestamp | auto | Payload-managed |

**Validation rules**:
- Email must be unique across all users.
- Password must be at least 8 characters.
- Role must be one of the two enum values.
- Owners must have exactly 1 entry in the tenants array.
- Admins may have 0 or more entries in the tenants array (no constraint).

**Access rules**:
- Admin users: full CRUD access to all users via admin panel.
- Owner users: read/update own record only; cannot create or delete users.
- Admin panel access: restricted to `role === 'admin'`.

---

### Workspace

Represents the tenant boundary and operational unit.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | auto-generated | primary key | Payload-managed, acts as `tenantId` |
| name | string | required, min 1 character | Display name for the workspace |
| slug | string | required, unique, kebab-case | URL-safe identifier |
| status | enum: `active`, `paused`, `disabled` | required, default: `active` | Controls AI runtime availability |
| createdAt | timestamp | auto | Payload-managed |
| updatedAt | timestamp | auto | Payload-managed |

**Validation rules**:
- Name must be non-empty.
- Slug must be unique, lowercase, kebab-case format.
- Status must be one of the three enum values.
- Defaults to `active` on creation (per clarification Q2).

**State transitions**:

```
  ┌──────────┐
  │  active   │ ◄─── default on creation
  └────┬──┬───┘
       │  │
  pause│  │disable
       │  │
  ┌────▼──┼───┐     ┌───────────┐
  │  paused│   │────►│ disabled   │
  └────┬───┘   │     └─────┬─────┘
       │       │           │
  activate     │      activate
       │       │           │
  ┌────▼───────┘     ┌─────▼─────┐
  │  active   │ ◄────│  active    │
  └───────────┘      └───────────┘
```

All transitions are admin-initiated (via admin panel). No automated transitions in v1.

**Access rules**:
- Admin users: full CRUD via admin panel.
- Owner users: read own workspace only (through tenant scoping).
- Workspace status changes: admin only.

---

### Environment Configuration (runtime, not persisted)

Not a database entity. Validated at application startup.

| Variable | Category | Required | Format | Default |
|----------|----------|----------|--------|---------|
| NODE_ENV | App | yes | `development` or `production` | — |
| APP_URL | App | yes | valid URL | — |
| PAYLOAD_SECRET | App | yes | string, min 32 chars | — |
| DATABASE_URL | Database | yes | valid PostgreSQL URL | — |
| R2_ENDPOINT | Storage | yes | valid URL | — |
| R2_REGION | Storage | no | string | `auto` |
| R2_ACCESS_KEY_ID | Storage | yes | string | — |
| R2_SECRET_ACCESS_KEY | Storage | yes | string | — |
| R2_BUCKET | Storage | yes | string | — |
| R2_PUBLIC_BASE_URL | Storage | no | valid URL | — |

Additional variables (OPENAI, QSTASH, WAHA, LLAMA_PARSE) are defined in the env schema but marked as optional-for-Phase-1 since they are not used until later phases. They are validated only when present.

## Relationships

```
User.tenants[0] ──► Workspace (many-to-one via plugin-managed array)
```

In v1, this is effectively a one-to-one relationship for owner users (max 1 tenant entry).

## Notes

- The `knowledge_files`, `agents`, `whatsapp_sessions`, `conversations`, `messages`, `message_traces`, `ingestion_jobs`, and `knowledge_chunks` collections are defined in Phase 2, not Phase 1.
- The `knowledge_vectors` SQL table (pgvector) is created in Phase 4, not Phase 1. Phase 1 only enables the `vector` extension.
- The Workspace entity is created as a collection in Phase 1 to satisfy the multi-tenant plugin's `tenantsSlug` requirement, but is populated in Phase 2 as part of the full data model setup.
