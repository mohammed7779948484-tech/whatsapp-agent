# Feature Specification: WAHA Integration and Workspace Status Gate

**Feature Branch**: `003-waha-workspace-status`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "Phase 3 from the master implementation plan — WAHA module, session provisioning, QR flow, webhook security, workspace status gate, locale-aware replies, session state persistence, and customer dashboard connection widgets"

---

## Context and Continuity

### What Spec 1 (Project Foundation) Already Established

- Bootable Next.js 16 + Payload CMS 3.79.1 application
- Neon PostgreSQL connectivity with pgvector enabled
- Cloudflare R2 storage wiring via `@payloadcms/storage-s3`
- Multi-tenant plugin configured with `tenantsSlug: 'workspaces'`
- Owner login, dashboard shell, and auth session helpers (`get-owner-dashboard-session`, `require-owner-session`, `verify-workspace-session`)
- Health/readiness endpoints (`GET /api/health`, `GET /api/health/ready`)
- Placeholder job routes (returning `501`) for all six QStash jobs and WAHA webhook
- Environment validation with fail-fast behavior (`src/core/env.ts`)
- Logger (`src/core/logger/`)
- Error hierarchy (`AppError`, `ErrorCode`)
- Feature registry pattern (`src/features/_registry/`)
- `auth-login` feature with `LoginForm`
- `owner-logout` widget
- Protected dashboard layout at `src/app/(frontend)/(dashboard)/layout.tsx`

### What Spec 2 (Database Setup) Already Established

- All core Payload collections: `workspaces` (extended with `owner`, `last_knowledge_update_at`), `agents`, `whatsapp_sessions`, `knowledge_files`, `knowledge_chunks`, `conversations`, `messages`, `message_traces`, `ingestion_jobs`
- `knowledge_vectors` pgvector SQL table with HNSW index
- Tenant-scoped access control: `workspaceScope`, `workspaceOwnerCrud`, `tracesAdminOnly`
- Invariant hooks: one-agent-per-workspace, one-session-per-workspace, one-owner-per-workspace
- Workspace deletion guard (blocks when dependents exist)
- Knowledge file lifecycle hooks (cascade delete of chunks and vectors)
- Denormalized workspace sync hooks for messages, chunks, and ingestion jobs
- Message trace relationship validation hook
- Development seed scripts (`seed:admin`, `seed:dev`)
- Retention cleanup query helper (`src/payload/lib/retention-cleanup.ts`)
- Workspace status type `'active' | 'paused' | 'disabled'` in `src/shared/types/workspace-status.ts`

### What Phase 3 Must Now Add

Phase 3 is the first spec that bridges the data layer to an external runtime service (WAHA). It must:

1. Create the WAHA provider client for communicating with the WAHA gateway
2. Create session management services (provisioning, QR, disconnect, status)
3. Build the customer-facing WhatsApp Connection feature (UI + Server Actions)
4. Implement WAHA webhook security (HMAC + IP allowlist)
5. Implement workspace lookup by WAHA session name
6. Implement the workspace status gate (active/paused/disabled routing)
7. Implement locale-aware system replies for paused/disabled/unsupported states
8. Persist WAHA session state updates from webhook events
9. Add customer dashboard widgets showing connection status

### What Phase 3 Must NOT Duplicate

- Collection creation — all collections already exist from Spec 2
- Access control functions — already exist from Spec 2
- Auth session helpers — already exist from Spec 1
- Environment validation scaffolding — already exists from Spec 1
- Health endpoints — already exist from Spec 1

---

## Clarifications

### Session 2026-04-05

- Q: What is the timeout and retry policy for WAHA API calls from Server Actions? → A: Fixed 10-second timeout per WAHA API call, no automatic retry. On failure, the error is returned to the owner who can retry manually from the UI.
- Q: Does Phase 3 transfer broad WAHA administration to the owner? → A: No. The owner can only manage the single WhatsApp connection for their own workspace (provision, view/refresh QR, disconnect, inspect status). The owner does NOT gain admin control over workspace status, multi-session behavior, or raw `whatsapp_sessions` collection CRUD.
- Q: How should owner-facing WhatsApp Connection actions persist `whatsapp_sessions` without exposing broad direct collection writes? → A: Keep direct collection create/update/delete access admin-only. Owner-facing Server Actions first verify the owner session and workspace, then call narrowly scoped server-side service methods that perform trusted persistence only for the already verified workspace session.

---

## User Scenarios & Testing

### User Story 1 — Customer Provisions and Connects a WhatsApp Number (Priority: P1)

A store owner logs in, navigates to the WhatsApp connection page, provisions a WAHA session for their workspace, scans the QR code with their phone, and confirms the session is connected. This is the foundational action that enables the entire WhatsApp agent to function.

**Why this priority**: Without a connected WhatsApp number, the entire platform has no value. This is the prerequisite for all downstream messaging flows.

**Independent Test**: Can be fully tested by creating an owner, navigating to the WhatsApp connection page, triggering provisioning, displaying a QR code, and verifying the session record is created and persisted. Delivers the ability to link a real WhatsApp number to the platform.

**Acceptance Scenarios**:

1. **Given** an owner is logged in and their workspace has no existing WAHA session, **When** the owner visits the WhatsApp connection page and triggers "Provision Session", **Then** the system creates a WAHA session named `workspace_${workspaceId}`, persists the session record, and displays a QR code for scanning.
2. **Given** a QR code is displayed, **When** the owner scans it with their phone's WhatsApp, **Then** the WAHA session transitions to "connected" status and the connected phone number is shown on the page.
3. **Given** a WAHA session already exists for the workspace, **When** the owner visits the WhatsApp connection page, **Then** the system shows the current session status, connected phone, and last sync time — without creating a duplicate session.
4. **Given** a connected session exists, **When** the owner clicks "Disconnect", **Then** the system disconnects the WAHA session, updates the session status to "disconnected", and displays the option to reconnect.

---

### User Story 2 — QR Code Refresh (Priority: P1)

A store owner's QR code expires before they manage to scan it. They click "Refresh QR" to get a new QR code without reprovisioning the full session.

**Why this priority**: QR expiry is a very common occurrence during the initial setup. Without a smooth refresh flow, the owner is stuck and cannot connect.

**Independent Test**: Can be tested by provisioning a session, waiting for an expired QR state, triggering refresh, and verifying a new QR appears.

**Acceptance Scenarios**:

1. **Given** a WAHA session exists but the QR code has expired, **When** the owner clicks "Refresh QR", **Then** the system fetches a new QR code from WAHA and displays it.
2. **Given** the WAHA gateway is unreachable, **When** the owner clicks "Refresh QR", **Then** the system shows a user-friendly error message and does not crash or hang.

---

### User Story 3 — Workspace Status Gate Enforcement (Priority: P1)

When a workspace is paused or disabled by an admin, any inbound WhatsApp message must not invoke the AI model. Instead, the system must respond with a fixed locale-aware unavailability reply.

**Why this priority**: This is a critical cost and safety control. A paused or disabled workspace must never invoke OpenAI and must never produce AI-generated content.

**Independent Test**: Can be tested by setting a workspace to "paused" or "disabled" status, sending a simulated inbound message, and verifying the system returns the static unavailability reply without calling any AI service.

**Acceptance Scenarios**:

1. **Given** a workspace status is `active`, **When** a valid inbound text message arrives, **Then** the workspace status gate allows the message to proceed to AI processing.
2. **Given** a workspace status is `paused`, **When** an inbound text message arrives, **Then** the system immediately returns the locale-aware unavailability reply and does not invoke any AI/LLM service.
3. **Given** a workspace status is `disabled`, **When** an inbound text message arrives, **Then** the system immediately returns the locale-aware unavailability reply and does not invoke any AI/LLM service.
4. **Given** a workspace status is `paused`, **When** the admin changes the status to `active`, **Then** subsequent inbound messages proceed to AI processing normally.

---

### User Story 4 — WAHA Webhook Security Enforcement (Priority: P1)

Inbound WAHA webhooks from the external gateway must be validated for authenticity before any data is read or processed. Invalid or forged requests must be rejected immediately.

**Why this priority**: Webhook security is a constitutional requirement (Article VIII). Accepting unauthenticated webhooks would allow injection of fake WhatsApp messages into the system.

**Independent Test**: Can be tested by sending a webhook request with a valid HMAC signature and allowed IP (should succeed), then sending one with an invalid signature (should be rejected), then sending one from a disallowed IP (should be rejected).

**Acceptance Scenarios**:

1. **Given** a webhook request arrives with a valid HMAC signature from an allowed IP, **When** the system processes the request, **Then** it passes validation and the event payload is processed.
2. **Given** a webhook request arrives with an invalid HMAC signature, **When** the system processes the request, **Then** it rejects the request immediately and does not persist or process any data.
3. **Given** a webhook request arrives from a disallowed IP address, **When** the system processes the request, **Then** it rejects the request immediately regardless of the HMAC value.
4. **Given** a webhook request arrives with a missing HMAC header, **When** the system processes the request, **Then** it is rejected.

---

### User Story 5 — Session State Persistence from Webhook Events (Priority: P2)

When WAHA sends session lifecycle events (connected, disconnected, QR updated, errors), the system must persist the updated state so the customer dashboard can accurately reflect the current WhatsApp connection status.

**Why this priority**: The dashboard should reflect reality. Without session state persistence, the owner sees stale or incorrect connection data.

**Independent Test**: Can be tested by simulating WAHA session lifecycle webhook events and verifying the `whatsapp_sessions` record is updated with the new status, QR, phone, and timestamps.

**Acceptance Scenarios**:

1. **Given** a WAHA session exists, **When** WAHA sends a "session connected" webhook event, **Then** the system updates `provider_status` to "connected", stores the connected phone number, and updates `last_synced_at`.
2. **Given** a connected session exists, **When** WAHA sends a "session disconnected" event, **Then** the system updates `provider_status` to "disconnected" and clears the connected phone.
3. **Given** a WAHA session exists, **When** WAHA sends a QR code update event, **Then** the system stores the new QR data on the session record.
4. **Given** a WAHA session exists, **When** WAHA sends a session error event, **Then** the system stores the error details in `last_error` on the session record.

---

### User Story 6 — Connection Summary on Customer Dashboard (Priority: P2)

The customer dashboard summary page shows the current WhatsApp connection status so the owner can quickly see whether their store number is connected and functioning.

**Why this priority**: Provides at-a-glance operational awareness. Without this, the owner must navigate to the dedicated connection page to check status.

**Independent Test**: Can be tested by creating workspace data with different WAHA session states and verifying the dashboard widget renders the correct status indicators.

**Acceptance Scenarios**:

1. **Given** the workspace has a connected WAHA session, **When** the owner views the dashboard, **Then** a connection summary widget shows "Connected" status with the phone number.
2. **Given** the workspace has no WAHA session, **When** the owner views the dashboard, **Then** the widget shows a "Not configured" state with a prompt to set up WhatsApp.
3. **Given** the workspace has a disconnected WAHA session, **When** the owner views the dashboard, **Then** the widget shows "Disconnected" status with a prompt to reconnect.

---

### User Story 7 — Locale-Aware System Replies (Priority: P2)

The system must deliver fixed replies in Arabic or English based on the agent's language preference or, if absent, the detected language of the latest inbound message.

**Why this priority**: Sending an English reply to an Arabic-speaking customer (or vice versa) is a poor user experience and undermines trust.

**Independent Test**: Can be tested by sending inbound messages in Arabic and English to workspaces with and without language preference set and verifying the system selects the correct locale for fixed replies.

**Acceptance Scenarios**:

1. **Given** a workspace agent has `language_preference` set to `ar`, **When** a fixed reply is triggered (paused, unsupported, or fallback), **Then** the system delivers the Arabic version of the reply.
2. **Given** a workspace agent has `language_preference` set to `en`, **When** a fixed reply is triggered, **Then** the system delivers the English version of the reply.
3. **Given** a workspace agent has no `language_preference` set, **When** a fixed reply is triggered and the latest inbound text is in Arabic, **Then** the system detects the locale and delivers the Arabic reply.
4. **Given** locale detection is ambiguous (e.g. mixed or empty text), **When** a fixed reply is triggered, **Then** the system defaults to Arabic.

---

### Edge Cases

- What happens when the WAHA gateway is completely unreachable during session provisioning? The WAHA API call enforces a 10-second timeout. If the call times out or fails, the system must return a clear error to the owner, not hang or crash, and no partial session record should be persisted.
- What happens when a workspace has a `whatsapp_sessions` record but the actual WAHA session was deleted externally? The system should treat the stale record gracefully — detect the mismatch when WAHA responds with a "session not found" error and allow re-provisioning.
- What happens when two rapid webhook events arrive for the same session (e.g. QR update followed immediately by connected)? Each event must be processed correctly and the final persisted state must reflect the last event.
- What happens when a webhook carries a valid HMAC but references a WAHA session name that does not map to any workspace? The event must be logged and discarded — not crash.
- What happens when the WAHA webhook delivers a message event but this spec does not yet implement full message processing? Message events should be acknowledged fast (200 OK) after synchronous security checks and lightweight routing. In Phase 3, paused/disabled workspaces and unsupported non-text messages may still receive fixed system replies synchronously, but AI message processing remains deferred to Phase 5. Only session lifecycle persistence and lightweight message gating are handled in this phase.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a WAHA provider client that can communicate with the WAHA gateway for session create, session delete, QR fetch, QR refresh, session status check, and text message send operations.
- **FR-002**: System MUST expose session provisioning as a Server Action callable from the WhatsApp Connection feature. The provisioned session MUST be named `workspace_${workspaceId}`.
- **FR-003**: System MUST expose QR code fetching as a Server Action. The QR code MUST be retrieved from WAHA and displayed to the owner.
- **FR-004**: System MUST expose QR code refresh as a Server Action. The owner MUST be able to request a fresh QR without reprovisioning the session.
- **FR-005**: System MUST expose session disconnection as a Server Action. The disconnected state MUST be persisted in `whatsapp_sessions`.
- **FR-006**: System MUST validate inbound WAHA webhooks using HMAC signature verification AND IP allowlist. Both checks MUST pass; failure of either MUST result in immediate rejection.
- **FR-007**: System MUST resolve a workspace from an incoming WAHA session name by parsing the workspace ID from the `workspace_${id}` naming convention.
- **FR-008**: System MUST implement a workspace status gate that checks workspace status before any AI or message processing. If status is `paused` or `disabled`, the system MUST skip AI and reply with the locale-aware unavailability message.
- **FR-009**: System MUST define locale-aware fixed reply constants for `UNAVAILABLE_REPLY`, `TEXT_ONLY_REPLY`, and `SAFE_FALLBACK_REPLY` in Arabic and English. These are not customer-editable.
- **FR-010**: System MUST determine the reply locale using: (1) `agent.language_preference` if set, otherwise (2) language detection from the latest inbound text, otherwise (3) Arabic as the default.
- **FR-011**: System MUST persist WAHA session lifecycle events (connected, disconnected, QR updated, errors) by updating the corresponding `whatsapp_sessions` record.
- **FR-012**: System MUST replace the current `501 Not Implemented` placeholder for `POST /api/webhooks/waha` with actual webhook validation and event routing logic.
- **FR-013**: System MUST build a WhatsApp Connection feature under `src/features/whatsapp-connection/` following the approved feature template with UI components, Server Actions, and types.
- **FR-014**: System MUST build a WAHA module under `src/modules/whatsapp/` following the approved module template with services, validators, types, and provider client.
- **FR-015**: System MUST build a workspaces module under `src/modules/workspaces/` (or extend if any scaffolding exists) with a workspace status gate service.
- **FR-016**: System MUST add a WhatsApp connection summary widget to the customer dashboard page showing current connection status, connected phone, and last sync time.
- **FR-017**: System MUST acknowledge inbound WAHA message events with `200 OK` immediately after synchronous security checks and lightweight routing. Actual AI message processing is deferred to Phase 5, but Phase 3 MAY still synchronously send the fixed `UNAVAILABLE_REPLY` for paused/disabled workspaces and `TEXT_ONLY_REPLY` for unsupported non-text inbound messages before returning `200 OK`.
- **FR-018**: System MUST implement a locale detection utility at `src/shared/lib/locale-from-text.ts` that distinguishes Arabic from English text. When detection is ambiguous, it MUST default to Arabic.
- **FR-019**: System MUST add environment variables for WAHA configuration (gateway URL, API key, HMAC secret, IP allowlist) to the environment validation layer.
- **FR-020**: System MUST register the new `whatsapp-connection` feature in the feature registry.
- **FR-021**: All Server Actions in the WhatsApp Connection feature MUST verify the owner session and resolve the workspace from the verified session before performing any operation.
- **FR-022**: All module service calls touching tenant-owned data MUST receive `tenantId` from the verified session. No tenant identity may be derived from client input.
- **FR-023**: The WAHA provider client MUST NOT expose or log API keys or HMAC secrets in error messages or responses returned to the browser.
- **FR-024**: The WAHA provider client MUST enforce a fixed 10-second timeout on every outbound API call to the WAHA gateway. No automatic retry is performed. On timeout or failure, the system MUST return a user-friendly error to the caller. The owner may retry manually from the UI.

### Key Entities

- **WAHA Session** (existing collection: `whatsapp_sessions`): Represents the WAHA session metadata linked to one workspace. Key attributes: `session_name`, `provider_status`, `qr_code`, `connected_phone`, `last_synced_at`, `last_error`.
- **Workspace** (existing collection: `workspaces`): Extended in Spec 2 with `owner` and `last_knowledge_update_at`. Status field (`active`/`paused`/`disabled`) is the gate for AI execution.
- **Agent** (existing collection: `agents`): `language_preference` field used for locale resolution.
- **Fixed System Replies**: Hardcoded locale-aware constant strings. Not stored in the database — defined as code constants.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: An owner can provision a WAHA session, see a QR code, and reach "connected" status in under 60 seconds (excluding QR scan time).
- **SC-002**: 100% of webhook requests with invalid HMAC signatures are rejected before any data processing occurs.
- **SC-003**: 100% of webhook requests from disallowed IPs are rejected before any data processing occurs.
- **SC-004**: When a workspace is paused or disabled, 100% of inbound messages receive the static unavailability reply with zero AI/LLM invocations.
- **SC-005**: The QR refresh action returns a new QR code to the owner within 5 seconds under normal conditions.
- **SC-006**: Session state changes from WAHA webhook events are persisted within 2 seconds and visible on the owner's next dashboard page load.
- **SC-007**: The locale detection utility correctly identifies Arabic and English text with greater than 90% accuracy on representative test inputs.
- **SC-008**: All Server Actions in this spec verify ownership and workspace association before executing — 0% of calls succeed without a valid owner session.

---

## Assumptions

- The WAHA gateway is already deployed on separate infrastructure (VPS/Railway/Render) and is reachable via HTTPS from the Vercel deployment. WAHA deployment itself is out of scope for this spec.
- WAHA is configured to deliver webhook events to a public URL on the Vercel deployment (`POST /api/webhooks/waha`).
- WAHA exposes a REST API for session management (create, delete, QR fetch, status), which is the integration surface for Phase 3.
- The WAHA HMAC secret and IP allowlist values are configured as environment variables and are available at runtime.
- The `whatsapp_sessions` collection (created in Spec 2) already has all required fields. No schema changes to existing collections are needed. Direct collection create/update/delete access remains admin-only; owner-facing WhatsApp Connection actions are implemented through verified Server Actions plus narrowly scoped trusted server-side persistence for the already verified workspace session.
- Full AI message ingestion and response generation are out of scope for Phase 3. The webhook handler still performs synchronous security checks and lightweight routing for `message` events so paused/disabled workspaces and unsupported non-text messages can receive fixed system replies before Phase 5 AI processing exists.
- The `src/shared/types/workspace-status.ts` type already defines `'active' | 'paused' | 'disabled'` from Spec 2.
- The customer dashboard skeleton from Spec 1 exists and can be extended with the connection summary widget.
- The `one-session-per-workspace` invariant from Spec 2 prevents duplicate session records. The provisioning flow must check for existing sessions before creating.
- Locale detection in v1 uses a simple heuristic (Unicode script detection) — no external NLP service is needed.
- The WAHA GOWS engine is the only supported engine per the constitution.
