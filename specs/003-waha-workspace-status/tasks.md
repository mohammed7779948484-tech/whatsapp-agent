# Tasks: WAHA Integration and Workspace Status Gate

**Input**: Design documents from `specs/003-waha-workspace-status/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Status**: Draft

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## User Story → Spec Mapping

| Label | Spec Story | Priority |
|---|---|---|
| US1 | Customer Provisions and Connects a WhatsApp Number | P1 |
| US2 | QR Code Refresh | P1 |
| US3 | Workspace Status Gate Enforcement | P1 |
| US4 | WAHA Webhook Security Enforcement | P1 |
| US5 | Session State Persistence from Webhook Events | P2 |
| US6 | Connection Summary on Customer Dashboard | P2 |
| US7 | Locale-Aware System Replies | P2 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared types, constants, and utilities needed by all user stories. These are foundational building blocks with no business logic yet.

- [X] T001 [P] Create the `SupportedLocale` type and `DEFAULT_LOCALE` constant in `src/shared/types/locale.ts`. Define `type SupportedLocale = 'ar' | 'en'` and `const DEFAULT_LOCALE: SupportedLocale = 'ar'`. Export both. This file must contain no business logic — just the type and the default.

- [X] T002 [P] Create the locale detection utility in `src/shared/lib/locale-from-text.ts`. Implement a function `localeFromText(text: string): SupportedLocale` that: (1) counts the number of Arabic Unicode characters (U+0600–U+06FF range) in the input, (2) counts the total alphabetic characters, (3) if ≥ 30% of alphabetic characters are Arabic, returns `'ar'`, (4) otherwise returns `'en'`, (5) if the text is empty or has no alphabetic characters, returns `DEFAULT_LOCALE` (which is `'ar'`). Import `SupportedLocale` and `DEFAULT_LOCALE` from `src/shared/types/locale.ts`. Export the function. No external dependencies allowed — use only built-in string/regex operations.

- [X] T003 [P] Create the fixed system reply constants in `src/shared/lib/system-replies.ts`. Define an object `SYSTEM_REPLIES` with three keys: `UNAVAILABLE_REPLY`, `TEXT_ONLY_REPLY`, and `SAFE_FALLBACK_REPLY`. Each key maps to `{ ar: string; en: string }`. Use the exact Arabic and English text from `specs/003-waha-workspace-status/data-model.md` section "Fixed System Reply Constants". Also export a helper function `getSystemReply(key: keyof typeof SYSTEM_REPLIES, locale: SupportedLocale): string` that returns the localized string. Import `SupportedLocale` from `src/shared/types/locale.ts`.

- [X] T004 Update the shared lib barrel export in `src/shared/lib/index.ts` to re-export `localeFromText` from `./locale-from-text` and `SYSTEM_REPLIES` / `getSystemReply` from `./system-replies`. Also update `src/shared/types/index.ts` to re-export `SupportedLocale` and `DEFAULT_LOCALE` from `./locale`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the WAHA provider client and promote environment variables. These MUST be complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Promote WAHA environment variables from optional to conditionally required in `src/core/env.ts`. Currently `WAHA_BASE_URL`, `WAHA_ADMIN_API_KEY`, and `WAHA_WEBHOOK_HMAC_SECRET` are optional. Change the validation logic so that: (1) if `ENABLE_WAHA_SANDBOX` is `false` (production), then `WAHA_BASE_URL`, `WAHA_ADMIN_API_KEY`, `WAHA_WEBHOOK_HMAC_SECRET`, and `WAHA_ALLOWED_IPS` are ALL required — throw if missing; (2) for `WAHA_ALLOWED_IPS`, fail if the raw env var is missing/empty or if the parsed array length is `0`; (3) if `ENABLE_WAHA_SANDBOX` is `true` (development), they remain optional with safe defaults (empty string for keys, empty array for IPs). Do NOT change the shape of the returned `env` object — keep the same field names. Do NOT break existing required variables (APP_URL, PAYLOAD_SECRET, DATABASE_URL, R2_*).

- [X] T005A [P] Extend `src/core/errors/error-codes.ts` with the WAHA/session-specific codes used by this phase: `WAHA_TIMEOUT`, `WAHA_API_ERROR`, `WAHA_NOT_CONFIGURED`, `SESSION_NOT_FOUND`, and `WORKSPACE_NOT_FOUND`. Do not remove the existing generic codes; add these alongside them so `AppError` usage in the WAHA client and service layer can stay explicit and type-safe.

- [X] T005B [P] Preserve the current direct write access model for `src/payload/collections/whatsapp-sessions.collection.ts`: direct browser/API create / update / delete access remains admin-only. Add an implementation note in the service layer that owner-facing WhatsApp Connection actions must use verified Server Actions plus narrowly scoped trusted server-side persistence for the already resolved workspace session, rather than widening raw collection write access.

- [X] T006 Create the low-level WAHA HTTP client at `src/core/providers/waha-client.ts`. This file provides a thin HTTP wrapper around the WAHA REST API. Before implementing, read the WAHA skill at `.agents/skills/WAHA/SKILL.md` and search the web for the current WAHA API documentation **and the pinned WAHA image's Swagger** to confirm endpoint paths and response shapes. Implement a class `WahaClient` with:
  - Constructor takes `{ baseUrl: string; apiKey: string }`.
  - All HTTP calls use the native `fetch` API (no axios). Every call MUST enforce a 10-second timeout using `AbortController` + `setTimeout(10_000)`. On timeout, throw `new AppError('WAHA request timed out', ErrorCode.WAHA_TIMEOUT, 504, 'medium')`.
  - Auth header: `X-Api-Key: ${apiKey}` on every request.
  - Methods:
    - `createSession(name: string, webhookUrl: string, hmacSecret: string): Promise<WahaSessionResponse>` → `POST /api/sessions` with body `{ name, config: { webhooks: [{ url: webhookUrl, events: ['session.status', 'message'], hmac: { key: hmacSecret } }] } }`.
    - `getSession(name: string): Promise<WahaSessionResponse>` → `GET /api/sessions/${name}`.
    - `deleteSession(name: string): Promise<void>` → `DELETE /api/sessions/${name}`. (Accept 404 gracefully — session may already be deleted.)
    - `getQrCode(session: string): Promise<{ mimetype: string; data: string }>` → use the WAHA image QR endpoint for the pinned image (for the docs reviewed on 2026-04-06: `GET /api/${session}/auth/qr?format=image` with `Accept: application/json`). Store/use only the returned base64 image `data` field in product code.
    - `sendText(session: string, chatId: string, text: string): Promise<void>` → `POST /api/sendText` with body `{ session, chatId, text }`.
  - Error handling: catch all fetch errors, wrap them in `new AppError('WAHA request failed', ErrorCode.WAHA_API_ERROR, 502, 'medium')`. NEVER include the API key or HMAC secret in error messages or logs.
  - Export the class and a factory function `createWahaClient()` that reads `env.WAHA_BASE_URL` and `env.WAHA_ADMIN_API_KEY` from `src/core/env.ts` and returns a `WahaClient` instance. If either is empty (sandbox mode), throw `new AppError('WAHA is not configured', ErrorCode.WAHA_NOT_CONFIGURED, 500, 'medium')`.
  - Define the `WahaSessionResponse` type in this file or import it from the module types. Import `AppError` and `ErrorCode` from `@/core/errors` so thrown errors match the current project signature.

**Checkpoint**: Foundation ready — shared types, locale detection, system replies, env validation, WAHA/session error codes, `whatsapp_sessions` owner access rules, and the WAHA HTTP client are all in place. User story implementation can begin.

---

## Phase 3: User Story 4 — WAHA Webhook Security Enforcement (Priority: P1)

**Goal**: Validate inbound WAHA webhooks using HMAC-SHA512 + IP allowlist before any data is read or processed.

**Independent Test**: Send a webhook with valid HMAC + allowed IP (should succeed), then send one with invalid HMAC (should be rejected), then from a disallowed IP (should be rejected).

**Why US4 first**: Webhook security is the prerequisite for all other webhook-based stories (US5 session state persistence depends on validated webhooks). Building this first ensures no insecure code path exists.

### Implementation for User Story 4

- [X] T007 [P] [US4] Create the WAHA module types file at `src/modules/whatsapp/types.ts`. Define the following types based on `specs/003-waha-workspace-status/data-model.md` and `specs/003-waha-workspace-status/contracts/waha-webhook.md`:
  - `WahaWebhookEventType = 'session.status' | 'message' | 'message.ack'`
  - `WahaSessionStatus = 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'STOPPED'`
  - `ProviderStatus = 'connected' | 'disconnected' | 'qr_pending' | 'error'` (matches the `whatsapp_sessions.provider_status` select options)
  - `WahaWebhookPayload` — the full webhook request body shape with fields: `event`, `session`, `payload`, `me?`
  - `WahaSessionStatusPayload` — the `payload` object inside a `session.status` event with field `status: WahaSessionStatus`
  - `WahaMessagePayload` — the `payload` object inside a `message` event with fields: `id`, `from`, `body?`, `timestamp`, `hasMedia?`, `media?`, `fromMe?`, and optional `type?`. Do NOT rely on `type` alone for unsupported-message routing because current WAHA docs emphasize `body` / `hasMedia` / `media`.
  - `ValidateWebhookResult = { valid: true; body: WahaWebhookPayload } | { valid: false; reason: string }`
  Export all types.

- [X] T008 [P] [US4] Create the WAHA module constants file at `src/modules/whatsapp/constants.ts`. Define:
  - `WAHA_STATUS_MAP: Record<WahaSessionStatus, ProviderStatus>` with mappings: `STARTING → disconnected`, `SCAN_QR_CODE → qr_pending`, `WORKING → connected`, `FAILED → error`, `STOPPED → disconnected`.
  - `WAHA_SESSION_NAME_PREFIX = 'workspace_'` — used for session naming and parsing.
  - `WAHA_HMAC_HEADER = 'x-webhook-hmac'` — the header name WAHA sends.
  - `WAHA_HMAC_ALGORITHM_HEADER = 'x-webhook-hmac-algorithm'`.
  - `WAHA_HMAC_ALGORITHM = 'sha512'` — the documented WAHA HMAC algorithm.
  Import types from `./types.ts`.

- [X] T009 [US4] Create the WAHA webhook validator at `src/modules/whatsapp/validators/validate-waha-webhook.ts`. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` and the WAHA skill at `.agents/skills/WAHA/SKILL.md`. Implement two exported functions:

  **`validateHmac(rawBody: string, hmacHeader: string | null, secret: string, algorithmHeader?: string | null): boolean`**:
  (1) If `hmacHeader` is null/empty, return `false`.
  (2) If `algorithmHeader` is present and not equal to `'sha512'` (case-insensitive), return `false`.
  (3) Compute HMAC-SHA512 of `rawBody` using `secret` with Node.js `crypto.createHmac('sha512', secret).update(rawBody).digest('hex')`.
  (4) Compare using `crypto.timingSafeEqual` (convert both to Buffer first). Return `true` if match.
  (5) Catch any error (e.g., mismatched lengths) and return `false`.

  **`validateIpAllowlist(clientIp: string, allowedIps: string[], sandboxMode: boolean): boolean`**:
  (1) If `sandboxMode` is `true`, return `true` (skip IP check in development).
  (2) If `allowedIps` is empty, return `false` (production must have at least one allowed IP).
  (3) Return `true` if `clientIp` is in the `allowedIps` array.

  Also export a helper **`extractClientIp(request: Request): string`**:
  (1) Read `x-forwarded-for` header from the request.
  (2) If present, return the first IP in the comma-separated list (trimmed).
  (3) If absent, return `'unknown'`.

  Import `crypto` from Node.js built-in module.

- [X] T010 [US4] Replace the WAHA webhook route placeholder at `src/app/api/webhooks/waha/route.ts`. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` and the WAHA skill at `.agents/skills/WAHA/SKILL.md`. The current file returns `501 Not Implemented` — replace it entirely with:

  **`POST` handler**:
  (1) Read the raw request body as text: `const rawBody = await request.text()`.
  (2) Extract `x-webhook-hmac` and `x-webhook-hmac-algorithm` headers.
  (3) Extract client IP using `extractClientIp(request)`.
  (4) Call `validateHmac(rawBody, hmacHeader, env.WAHA_WEBHOOK_HMAC_SECRET, algorithmHeader)`. If false → return `401 { error: 'Unauthorized' }`.
  (5) Call `validateIpAllowlist(clientIp, env.WAHA_ALLOWED_IPS, env.ENABLE_WAHA_SANDBOX)`. If false → return `401 { error: 'Unauthorized' }`.
  (6) Parse `rawBody` as JSON into `WahaWebhookPayload`.
  (7) Extract `event` field. Route:
     - If `event === 'session.status'` → call `handleSessionStatusEvent(payload)` (stub for now — this will be replaced by T030).
     - If `event === 'message'` → call `handleMessageEvent(payload)` (stub for now — this will be replaced by T030 with status-gate / unsupported handling).
     - Otherwise → return `200 { status: 'ok' }` (discard unknown events).
  (8) Wrap all in try/catch → on error, log with `Logger` and return `500 { error: 'Internal server error' }`.
  (9) `handleSessionStatusEvent` stub: log the session name and status, return `200 { status: 'ok' }`. Mark with a `// TODO: T029/T030 will implement session state persistence` comment.
  (10) `handleMessageEvent` stub: return `200 { status: 'ok' }` immediately. Mark with a `// TODO: T030 will implement paused/disabled and unsupported-message handling` comment.

  Import from: `@/modules/whatsapp/validators/validate-waha-webhook`, `@/modules/whatsapp/types`, `@/core/env`, `@/core/logger`.
  Do NOT import from `@/payload/collections/` (features/routes never import Payload collections directly — delegate to module services).

**Checkpoint**: Webhook security is enforced. Invalid HMAC or disallowed IP → 401. Valid requests are parsed and routed by event type. Session status handling is stubbed.

---

## Phase 4: User Story 1 — Customer Provisions and Connects a WhatsApp Number (Priority: P1)

**Goal**: Owner can provision a WAHA session, see the QR code, and reach "connected" status.

**Independent Test**: Log in as owner → navigate to WhatsApp page → click Provision → see QR → verify session record created in DB.

**Depends on**: Phase 2 (WAHA client), Phase 3 (webhook route for receiving status updates)

### Implementation for User Story 1

- [ ] T011 [US1] **Depends on T005A** (the `ErrorCode.SESSION_NOT_FOUND` value must exist before this task). Create the WAHA module service at `src/modules/whatsapp/services/whatsapp.service.ts`. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` and its reference files under `.agents/skills/payload/reference/` — especially QUERIES.md for Local API patterns and HOOKS.md for hook behavior. Also read the WAHA skill at `.agents/skills/WAHA/SKILL.md`. Follow the module template at `.specify/memory/standards/module-template.md` exactly.

  Implement a class `WhatsAppService` with the following methods:

  **`async provisionSession(workspaceId: string | number, user: User): Promise<{ sessionId: string; providerStatus: ProviderStatus; qrCode?: string | null }>`**:
  (0) Get the Payload instance **inside the module** via `getPayloadClient()` from `@/payload/lib` before doing anything else. This is intentional: features and app pages must not call `getPayloadClient()` directly.
  (1) Query `whatsapp_sessions` with `where: { workspace: { equals: workspaceId } }`, `limit: 1`, `user`, and `overrideAccess: false`. This owner-facing read must respect access rules.
  (2) Compute `sessionName = 'workspace_' + workspaceId`.
  (3) If a local session exists and `provider_status !== 'error'`, verify the remote WAHA session still exists via `createWahaClient().getSession(sessionName)`. If the remote session exists, return the existing local session data. If WAHA reports that the session is missing, treat the local record as stale and continue to re-provision.
  (4) If a local session exists and `provider_status === 'error'`, or if the record is stale, call `createWahaClient().deleteSession(sessionName)` (accept 404) and then delete the local Payload record via a trusted server-side `payload.delete(...)` call using the already resolved session document ID and `overrideAccess: true`. This path is intentional: direct owner collection deletes remain closed, so the service performs the narrow delete only after the owner session/workspace has been verified and the record has been resolved by owner-scoped read. If local delete fails after remote delete, log the inconsistency and continue with re-provisioning.
  (5) Call `createWahaClient().createSession(sessionName, env.APP_URL + '/api/webhooks/waha', env.WAHA_WEBHOOK_HMAC_SECRET)`.
  (6) Create a new `whatsapp_sessions` record via a trusted server-side `payload.create(...)` call with `{ workspace: workspaceId, session_name: sessionName, provider_status: 'disconnected' }` and `overrideAccess: true`. Do not accept workspace or session identifiers from client input — use only the verified `workspaceId` and computed `sessionName`.
  (7) Try to fetch QR code via `createWahaClient().getQrCode(sessionName)`. If successful, update the just-created record with `qr_code: qr.data` and `provider_status: 'qr_pending'` through a trusted server-side `payload.update(...)` call using the known record ID and `overrideAccess: true`. If QR fetch fails because the session is not ready yet, skip — `session.status` will deliver `SCAN_QR_CODE` later and the webhook path will fetch the updated QR then.
  (8) Return `{ sessionId: record.id, providerStatus: record.provider_status, qrCode: record.qr_code ?? null }`.

  **`async getSessionForWorkspace(workspaceId: string | number, user: User): Promise<WhatsappSession | null>`**:
  (0) Get the Payload instance **inside the module** via `getPayloadClient()` from `@/payload/lib`.
  (1) Query `whatsapp_sessions` with `where: { workspace: { equals: workspaceId } }`, `limit: 1`, `user`, and `overrideAccess: false`.
  (2) Return the first doc or null.

  **`async disconnectSession(workspaceId: string | number, user: User): Promise<void>`**:
  (0) Get the Payload instance **inside the module** via `getPayloadClient()` from `@/payload/lib`.
  (1) Find the session record for the workspace using `user` + `overrideAccess: false`. This owner-scoped read determines the only record the service is allowed to mutate.
  (2) If no session exists, throw `new AppError('No session found', ErrorCode.SESSION_NOT_FOUND, 404, 'medium')`.
  (3) Call `createWahaClient().deleteSession(session.session_name)` (accept 404).
  (4) Update the resolved session record with `provider_status: 'disconnected'`, clear `connected_phone`, clear `qr_code`, and update `last_synced_at` through a trusted server-side `payload.update(...)` call using the resolved record ID and `overrideAccess: true`.

  **`async refreshQrCode(workspaceId: string | number, user: User): Promise<{ qrCode: string }>`**:
  (0) Get the Payload instance **inside the module** via `getPayloadClient()` from `@/payload/lib`.
  (1) Find the session record using `user` + `overrideAccess: false`. This owner-scoped read determines the only record the service is allowed to mutate.
  (2) If no session, throw `new AppError('No session found', ErrorCode.SESSION_NOT_FOUND, 404, 'medium')`.
  (3) Call `createWahaClient().getQrCode(session.session_name)`.
  (4) Update the resolved session record with `qr_code: qr.data`, `provider_status: 'qr_pending'`, and `last_synced_at` through a trusted server-side `payload.update(...)` call using the resolved record ID and `overrideAccess: true`.
  (5) Return `{ qrCode: qr.data }`.

  **`resolveWorkspaceIdFromSessionName(sessionName: string): string | null`**:
  (1) If `sessionName` starts with `WAHA_SESSION_NAME_PREFIX`, return the part after the prefix.
  (2) Otherwise return `null`.

  Import types from `../types.ts`, constants from `../constants.ts`, `createWahaClient` from `@/core/providers/waha-client`, `AppError` and `ErrorCode` from `@/core/errors`, `Logger` from `@/core/logger`, `env` from `@/core/env`, and `getPayloadClient` from `@/payload/lib`. Import `User` and `WhatsappSession` from `@/payload-types`. Do not import `withTenantContext` here — the module owns Payload access internally for these owner-facing methods, so features and app pages never call `getPayloadClient()` directly. Also add a short code comment above the trusted `whatsapp_sessions` write path explaining why direct owner CRUD on the collection remains closed and why these specific writes intentionally use the already verified workspace/session context instead.
- [ ] T012 [US1] Create the WAHA module barrel export at `src/modules/whatsapp/index.ts`. Export `WhatsAppService` from `./services/whatsapp.service`, all types from `./types`, all constants from `./constants`, and `validateHmac` / `validateIpAllowlist` / `extractClientIp` from `./validators/validate-waha-webhook`. Follow the module template at `.specify/memory/standards/module-template.md`.

- [ ] T013 [US1] Create the WAHA module README at `src/modules/whatsapp/README.md`. Follow the module template at `.specify/memory/standards/module-template.md`. Document: purpose (WAHA gateway integration), consumers (`features/whatsapp-connection`, `app/api/webhooks/waha`), public API table (WhatsAppService methods, validator functions, types), dependencies (`core/providers/waha-client`, `core/env`, `core/errors`, `core/logger`).

- [ ] T014 [US1] Create the `whatsapp-connection` feature scaffold. Follow the feature template at `.specify/memory/standards/feature-template.md` exactly. Create these files:

  **`src/features/whatsapp-connection/feature.config.ts`**: Define `whatsappConnectionConfig: FeatureConfig` with `id: 'whatsapp-connection'`, `name: 'WhatsApp Connection'`, `description: 'Provision and manage WAHA WhatsApp sessions'`, `dependencies: ['modules/whatsapp']`, `enabled: true`.

  **`src/features/whatsapp-connection/types.ts`**: Define `WhatsAppConnectionState` interface with fields: `sessionId: string | null`, `providerStatus: ProviderStatus | null`, `qrCode: string | null`, `connectedPhone: string | null`, `lastSyncedAt: string | null`, `lastError: string | null`.

  **`src/features/whatsapp-connection/constants.ts`**: Define `PROVIDER_STATUS_LABELS: Record<ProviderStatus, string>` with human-friendly labels (`connected → 'Connected'`, etc.) and `PROVIDER_STATUS_COLORS: Record<ProviderStatus, string>` for UI color coding.

  **`src/features/whatsapp-connection/README.md`**: Follow the feature template README format.

  **`src/features/whatsapp-connection/index.ts`**: Export `WhatsAppConnectionPage` from `./ui/WhatsAppConnectionPage`, export `WhatsAppDashboardSummary` from `./ui/WhatsAppDashboardSummary`, export types from `./types`, and export the config from `./feature.config`.

- [ ] T015 [US1] Create the provision Server Action at `src/features/whatsapp-connection/actions/provision-whatsapp-session.action.ts`. Follow the Server Action template in `.specify/memory/standards/feature-template.md` exactly. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` — specifically the Security Pitfalls section about `overrideAccess`.

  The action MUST:
  (1) Start with `'use server'` directive.
  (2) Call `getOwnerDashboardSession()` from `@/core/auth` to get the authenticated owner session. The current helper redirects to `/login` on failure and otherwise returns `{ user, workspaceId }`, so do not add a dead `if (!session)` branch unless the helper is changed first.
  (3) Call `new WhatsAppService().provisionSession(workspaceId, user)`.
  (4) On success, return `success({ sessionId, providerStatus, qrCode })`.
  (5) On error, catch `AppError`, log with Logger, return `failure(error.message, error.code)`. For non-AppError, return `failure('Failed to provision WhatsApp session', 'PROVISION_FAILED')`.

  Do NOT import from `@/payload/collections/` — the Service handles all DB access.

- [ ] T016 [US1] Create the disconnect Server Action at `src/features/whatsapp-connection/actions/disconnect-whatsapp-session.action.ts`. Same pattern as T015: `'use server'` → call `getOwnerDashboardSession()` (remember: it redirects on failure and otherwise returns `{ user, workspaceId }`) → call `new WhatsAppService().disconnectSession(workspaceId, user)` → return `success(undefined)` or `failure(...)`. Follow the feature template Server Action pattern exactly.

- [ ] T017 [US1] Create the WhatsApp session status UI component at `src/features/whatsapp-connection/ui/_components/WhatsAppSessionStatus.tsx`. This is a React Server Component that receives session data as props and renders:
  - A status badge showing the `provider_status` with appropriate color (from `PROVIDER_STATUS_COLORS`)
  - The connected phone number (if connected)
  - The last synced timestamp (if available)
  - An error message (if `provider_status === 'error'`)
  Props type: `{ status: ProviderStatus | null; connectedPhone?: string | null; lastSyncedAt?: string | null; lastError?: string | null }`.
  This component has NO business logic — it is purely presentational.

- [ ] T018 [US1] Create the WhatsApp QR card UI component at `src/features/whatsapp-connection/ui/_components/WhatsAppQrCard.tsx`. This is a Client Component (`'use client'`). It receives `qrCode: string | null` and `providerStatus: ProviderStatus` as props. Render:
  - If `qrCode` is present and `providerStatus` is `'qr_pending'`, show the QR image via `<img src={`data:image/png;base64,${qrCode}`} />` with appropriate sizing.
  - A "Refresh QR" button that calls the `refreshWhatsappQrAction` Server Action and updates local state.
  - If `providerStatus` is `'connected'`, show a success message instead of QR.
  - If `providerStatus` is `'disconnected'` and no QR, show a prompt to provision.
  - Loading state while the refresh action is pending (use `useTransition` from React).

- [ ] T019 [US1] Create the main WhatsApp Connection page component at `src/features/whatsapp-connection/ui/WhatsAppConnectionPage.tsx`. This is a React Server Component that:
  (1) Gets the owner session via `getOwnerDashboardSession()`.
  (2) Calls `new WhatsAppService().getSessionForWorkspace(workspaceId, user)` to load the current session. Do **not** call `getPayloadClient()` inside this feature component — the module must own Payload access.
  (3) Renders `WhatsAppSessionStatus` with the session data.
  (4) Renders `WhatsAppQrCard` with the QR code and status.
  (5) Renders a "Provision Session" button (if no session exists) that calls the provision action.
  (6) Renders a "Disconnect" button (if session exists) that calls the disconnect action.
  Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` for Local API query patterns.

- [ ] T020 [US1] Create the WhatsApp connection route page at `src/app/(frontend)/(dashboard)/whatsapp/page.tsx`. This is a thin Next.js page component that imports and renders `WhatsAppConnectionPage` from `@/features/whatsapp-connection`. Add appropriate page metadata (`title: 'WhatsApp Connection'`). The page layout protection is already handled by the dashboard layout at `src/app/(frontend)/(dashboard)/layout.tsx` from Spec 1.

- [ ] T021 [US1] Register the `whatsapp-connection` feature in the feature registry at `src/features/_registry/index.ts`. Import `whatsappConnectionConfig` from `@/features/whatsapp-connection` and add it to the `featureRegistry` Map alongside the existing `authLoginConfig`, matching the current registry pattern used by `auth-login`.

**Checkpoint**: Owner can provision a WAHA session, see a QR code, and disconnect. The session record is persisted in DB. Webhook route is live with security enforced.

---

## Phase 5: User Story 2 — QR Code Refresh (Priority: P1)

**Goal**: Owner can refresh an expired QR code without reprovisioning the session.

**Independent Test**: Provision a session → trigger QR refresh → verify new QR appears.

**Depends on**: Phase 4 (US1 — session must exist to refresh QR)

### Implementation for User Story 2

- [ ] T022 [US2] Create the refresh QR Server Action at `src/features/whatsapp-connection/actions/refresh-whatsapp-qr.action.ts`. Same pattern as T015: `'use server'` → call `getOwnerDashboardSession()` (remember: it redirects on failure and otherwise returns `{ user, workspaceId }`) → call `new WhatsAppService().refreshQrCode(workspaceId, user)` → return `success({ qrCode })` or `failure(...)`. Follow the feature template Server Action pattern exactly.

**Checkpoint**: QR refresh is available. The `WhatsAppQrCard` component (T018) already has the refresh button wired to this action.

---

## Phase 6: User Story 3 — Workspace Status Gate Enforcement (Priority: P1)

**Goal**: When a workspace is paused or disabled, the system blocks AI processing and returns a fixed unavailability reply.

**Independent Test**: Set workspace to `'paused'` → send simulated inbound message → verify the gate blocks and returns the static reply.

### Implementation for User Story 3

- [ ] T023 [P] [US3] Create the workspaces module types file at `src/modules/workspaces/types.ts`. Define:
  - `WorkspaceGateResult = { allowed: true } | { allowed: false; reason: 'paused' | 'disabled'; replyText: string }`
  This type represents the decision output of the workspace status gate.
  Import `WorkspaceStatus` from `@/shared/types/workspace-status`.

- [ ] T024 [P] [US3] Create the workspaces module constants file at `src/modules/workspaces/constants.ts`. Define any constants needed (can be minimal — the main constants are in `src/shared/types/workspace-status.ts` and `src/shared/lib/system-replies.ts`).

- [ ] T025 [US3] Create the workspace status validator at `src/modules/workspaces/validators/validate-workspace-status.ts`. Export a function `isActiveWorkspace(status: WorkspaceStatus): boolean` that returns `true` only if status is `'active'`. Import `WorkspaceStatus` from `@/shared/types/workspace-status`.

- [ ] T026 [US3] **Depends on T005A** (the `ErrorCode.WORKSPACE_NOT_FOUND` value must exist before this task). Create the workspaces module service at `src/modules/workspaces/services/workspaces.service.ts`. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` and its reference files under `.agents/skills/payload/reference/` — especially QUERIES.md for Local API patterns. Follow the module template at `.specify/memory/standards/module-template.md` exactly.

  Implement a class `WorkspacesService` with:

  **`resolveReplyLocale(agentLanguagePreference: SupportedLocale | null | undefined, inboundText: string): SupportedLocale`**:
  (1) If `agentLanguagePreference` is `'ar'` or `'en'`, return it.
  (2) Otherwise, call `localeFromText(inboundText)`.
  (3) Return the detected locale (which already defaults to Arabic when ambiguous).

  **`async checkStatusGate(workspaceId: string | number, payload: PayloadInstance, inboundText: string = ''): Promise<WorkspaceGateResult>`**:
  (1) Load the workspace by ID via `payload.findByID({ collection: 'workspaces', id: workspaceId, overrideAccess: true })`. This is a trusted system-level webhook/job path, so `overrideAccess: true` is intentional here.
  (2) If workspace not found, throw `new AppError('Workspace not found', ErrorCode.WORKSPACE_NOT_FOUND, 404, 'medium')`.
  (3) If workspace `status` is `'active'`, return `{ allowed: true }`.
  (4) If `'paused'` or `'disabled'`:
     - Load the agent for this workspace via `payload.find({ collection: 'agents', where: { workspace: { equals: workspaceId } }, limit: 1, overrideAccess: true })`.
     - Determine locale by calling `resolveReplyLocale(agent.language_preference, inboundText)`.
     - Get reply text via `getSystemReply('UNAVAILABLE_REPLY', locale)`.
     - Return `{ allowed: false, reason: status, replyText }`.

  **`async getWorkspaceForOwner(workspaceId: string | number, payload: PayloadInstance, user: User): Promise<Workspace>`**:
  (1) Load workspace via `payload.findByID({ collection: 'workspaces', id: workspaceId, user, overrideAccess: false })`.
  (2) If not found, throw `new AppError('Workspace not found', ErrorCode.WORKSPACE_NOT_FOUND, 404, 'medium')`.
  (3) Return the workspace.

  Import types from `../types.ts`, `getSystemReply` from `@/shared/lib/system-replies`, `localeFromText` from `@/shared/lib/locale-from-text`, `SupportedLocale` from `@/shared/types/locale`, `AppError` and `ErrorCode` from `@/core/errors`, `Logger` from `@/core/logger`. Import `Workspace`, `User`, `Agent` from `@/payload-types`.

- [ ] T027 [US3] Create the workspaces module barrel export at `src/modules/workspaces/index.ts`. Export `WorkspacesService` from `./services/workspaces.service`, all types from `./types`, `isActiveWorkspace` from `./validators/validate-workspace-status`.

- [ ] T028 [US3] Create the workspaces module README at `src/modules/workspaces/README.md`. Follow the module template. Document: purpose (workspace status gate and owner workspace queries), consumers (`app/api/webhooks/waha`, `features/whatsapp-connection`, future `app/api/jobs/process-inbound-message`), public API table, dependencies.

**Checkpoint**: The workspace status gate is implemented. When a workspace is paused/disabled, `checkStatusGate` returns the localized unavailability reply. This gate will be wired into the webhook route in T030 and reused later by the Phase 5 message-processing job.

---

## Phase 7: User Story 5 — Session State Persistence from Webhook Events (Priority: P2)

**Goal**: When WAHA sends session lifecycle webhook events, the system persists the updated state.

**Independent Test**: Simulate a WAHA `session.status` webhook with `status: WORKING` → verify `whatsapp_sessions` record updated to `provider_status: 'connected'`.

**Depends on**: Phase 3 (US4 — webhook route), Phase 4 (US1 — WhatsApp service)

### Implementation for User Story 5

- [ ] T029 [US5] Add the `updateSessionState` method to `WhatsAppService` in `src/modules/whatsapp/services/whatsapp.service.ts`. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` — especially the Local API update patterns in reference/QUERIES.md. Do not guess Payload behavior from memory; use the repository Payload skill/reference as the source of truth.

  **`async updateSessionState(sessionName: string, wahaStatus: WahaSessionStatus, eventData: Partial<{ qrCode?: string; phone?: string; error?: string }>, payload: PayloadInstance): Promise<void>`**:
  (1) Find the session record by `session_name` via `payload.find({ collection: 'whatsapp_sessions', where: { session_name: { equals: sessionName } }, limit: 1, overrideAccess: true })`.
  (2) If no session found, log a warning and return (do not crash — the session may have been deleted).
  (3) If `wahaStatus` is not present in `WAHA_STATUS_MAP`, log a warning and return without updating.
  (4) Map `wahaStatus` to `providerStatus` using `WAHA_STATUS_MAP` from constants.
  (5) Build update data: `{ provider_status: providerStatus, last_synced_at: new Date().toISOString() }`.
  (6) If `providerStatus === 'connected'` and `eventData.phone`, add `connected_phone`.
  (7) If `providerStatus === 'qr_pending'` and `eventData.qrCode`, add `qr_code`.
  (8) If `providerStatus === 'error'` and `eventData.error`, add `last_error`.
  (9) If `providerStatus === 'disconnected'`, clear `connected_phone` and `qr_code` (set to `''`).
  (10) Call `payload.update({ collection: 'whatsapp_sessions', id: session.id, data: updateData, overrideAccess: true })`.
  (11) Log the state transition with Logger.
- [ ] T030 [US5] Replace the webhook stubs created in T010 with real route handling at `src/app/api/webhooks/waha/route.ts`. Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md`.

  The final route behavior must be:
  (1) For `session.status` events: extract `session` and `payload.status`. Resolve the workspace via `resolveWorkspaceIdFromSessionName(session)`. If unknown, log warning and return `200 { status: 'ok', note: 'unknown session' }`.
  (2) For `session.status: SCAN_QR_CODE`, fetch the updated QR from WAHA via `createWahaClient().getQrCode(session)` instead of trusting `body.qr?.value`. Store `qr.data` only.
  (3) For `session.status`, normalize `phone` from `body.me?.id` by stripping the `@c.us` suffix before persistence. Use the same normalized-number rule everywhere in this spec.
  (4) Get the Payload instance via `getPayloadClient()` from `@/payload/lib`.
  (5) Call `new WhatsAppService().updateSessionState(session, body.payload.status, { qrCode, phone, error }, payloadInstance)`. Return `200 { status: 'ok' }`.
  (6) For `message` events: resolve the workspace from the session name. If unknown, log and return `200`.
  (7) Run `new WorkspacesService().checkStatusGate(workspaceId, payloadInstance, body.payload.body ?? '')`. If blocked, call `createWahaClient().sendText(session, body.payload.from, gate.replyText)` and return `200 { status: 'ok' }` without any AI processing.
  (8) If the message is unsupported/non-text (for Phase 3, treat `payload.hasMedia === true` OR missing/empty `payload.body` as unsupported; do not rely on `type` alone), resolve the reply locale, send `getSystemReply('TEXT_ONLY_REPLY', locale)` via WAHA, and return `200 { status: 'ok' }`.
  (9) Otherwise, acknowledge `200 { status: 'ok' }` immediately. Full AI message processing is deferred to Phase 5.
  (10) Wrap the route in try/catch. Validation failures still return `401`. For trusted, already-validated `session.status` / `message` events, log unexpected errors and prefer returning `200 { status: 'ok' }` to avoid noisy retries from WAHA.

**Checkpoint**: Session lifecycle events from WAHA → webhook → validated → `whatsapp_sessions` record updated. Dashboard will reflect current status.

---

## Phase 8: User Story 7 — Locale-Aware System Replies (Priority: P2)

**Goal**: Fixed replies are delivered in Arabic or English based on agent preference or text detection.

**Independent Test**: Call `resolveReplyLocale` with different agent preferences and inbound texts → verify correct locale is returned.

### Implementation for User Story 7

- [ ] T031 [US7] Export the locale-resolution helper from the workspaces module. The actual `resolveReplyLocale(...)` implementation was created in T026 to avoid duplicate logic. In this task:

  (1) Export `resolveReplyLocale` from `src/modules/workspaces/index.ts`.
  (2) Update the workspaces module README to document the locale chain: `agent.language_preference` → `localeFromText(inboundText)` → Arabic default.
  (3) Do NOT duplicate the locale logic in multiple places. All paused/disabled and unsupported-message fixed replies must use the single helper from `workspaces.service.ts`.

**Checkpoint**: Locale resolution chain is complete: agent preference → text detection → Arabic default. The `checkStatusGate` method in the WorkspacesService already uses this chain for unavailability replies.

---

## Phase 9: User Story 6 — Connection Summary on Customer Dashboard (Priority: P2)

**Goal**: Dashboard shows a WhatsApp connection summary widget.

**Independent Test**: View dashboard with connected/disconnected/no session → verify widget shows correct state.

**Depends on**: Phase 4 (US1 — WhatsApp service for session lookup)

### Implementation for User Story 6

- [ ] T032 [US6] Create the WhatsApp connection summary widget at `src/widgets/whatsapp-status/WhatsAppStatusWidget.tsx`. This widget must be **presentational only** to respect the project layering rules for `widgets/`. It is a React Server Component that:
  (1) Receives a preloaded prop like `{ session: WhatsappSession | null }` (or an equivalent serializable summary shape).
  (2) Does **not** call module services or Payload directly.
  (3) Renders a card showing:
     - If no session: "Not configured" state with a link to `/whatsapp`.
     - If `provider_status === 'connected'`: "Connected" badge + phone number + last synced time.
     - If `provider_status === 'disconnected'`: "Disconnected" badge + link to reconnect at `/whatsapp`.
     - If `provider_status === 'qr_pending'`: "Awaiting scan" badge + link to `/whatsapp`.
     - If `provider_status === 'error'`: "Error" badge + last error excerpt.
  Use colors/labels from `PROVIDER_STATUS_LABELS` and `PROVIDER_STATUS_COLORS` in `src/features/whatsapp-connection/constants.ts`.

  Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` for Server Component composition patterns.

- [ ] T033 [US6] Create the widget barrel export at `src/widgets/whatsapp-status/index.ts`. Export `WhatsAppStatusWidget` as the default/named export.

- [ ] T034 [US6] Create a feature-owned server component at `src/features/whatsapp-connection/ui/WhatsAppDashboardSummary.tsx` and integrate it into the customer dashboard page at `src/app/(frontend)/(dashboard)/dashboard/page.tsx`.
  - In `WhatsAppDashboardSummary.tsx`: call `getOwnerDashboardSession()`, then call `new WhatsAppService().getSessionForWorkspace(workspaceId, user)`, and render `WhatsAppStatusWidget` with the resulting session data. Do **not** call `getPayloadClient()` inside this feature component — the module must own Payload access.
  - In `dashboard/page.tsx`: keep the page aligned with the constitution layering rules by importing the feature component from `@/features/whatsapp-connection` and rendering it alongside the existing dashboard content. The page itself must **not** import `@/modules/*` or `@/payload/lib` directly.
  - The widget itself remains presentational only.
  Before implementing, read the Payload skill at `.agents/skills/payload/SKILL.md` for Server Component composition patterns.

**Checkpoint**: Dashboard shows real-time WhatsApp connection status. Owner gets at-a-glance operational awareness.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Tests, validation, and documentation.

- [ ] T035 [P] Create unit tests for HMAC validation in `tests/unit/modules/whatsapp/validate-waha-webhook.test.ts`. Test cases:
  (1) Valid HMAC-SHA512 with matching secret → returns `true`.
  (2) Invalid HMAC (wrong secret) → returns `false`.
  (3) Missing HMAC header (null) → returns `false`.
  (4) Empty HMAC header → returns `false`.
  (5) Algorithm header present but not `sha512` → returns `false`.
  Use Node.js `crypto` to generate valid HMACs in tests.

- [ ] T036 [P] Create unit tests for IP allowlist validation in `tests/unit/modules/whatsapp/validate-waha-webhook.test.ts` (same file as T035). Test cases:
  (1) Allowed IP → returns `true`.
  (2) Disallowed IP → returns `false`.
  (3) Empty allowlist in production mode → returns `false`.
  (4) Any IP in sandbox mode → returns `true`.
  (5) `extractClientIp` with `x-forwarded-for` header → returns first IP.
  (6) `extractClientIp` without header → returns `'unknown'`.

- [ ] T037 [P] Create unit tests for workspace status gate in `tests/unit/modules/workspaces/workspaces.service.test.ts`. Test cases:
  (1) Active workspace → returns `{ allowed: true }`.
  (2) Paused workspace with Arabic agent preference → returns `{ allowed: false }` with Arabic reply.
  (3) Disabled workspace → returns `{ allowed: false }`.
  Mock the Payload instance (mock `findByID` and `find` methods).

- [ ] T038 [P] Create unit tests for locale detection in `tests/unit/shared/locale-from-text.test.ts`. Test cases:
  (1) Arabic text (مرحبا كيف حالك) → returns `'ar'`.
  (2) English text ("Hello, how are you?") → returns `'en'`.
  (3) Mixed text with > 30% Arabic → returns `'ar'`.
  (4) Mixed text with < 30% Arabic → returns `'en'`.
  (5) Empty string → returns `'ar'` (default).
  (6) Numbers only → returns `'ar'` (default).

- [ ] T039 [P] Create unit tests for system replies in `tests/unit/shared/system-replies.test.ts`. Test cases:
  (1) `getSystemReply('UNAVAILABLE_REPLY', 'ar')` → returns the Arabic unavailability string.
  (2) `getSystemReply('UNAVAILABLE_REPLY', 'en')` → returns the English unavailability string.
  (3) All three reply keys exist and have both `ar` and `en` values.

- [ ] T040 [P] Create unit tests for WAHA constants and client safety in `tests/unit/modules/whatsapp/constants.test.ts` and `tests/unit/modules/whatsapp/waha-client.test.ts`. Test cases:
  (1) `WAHA_STATUS_MAP['WORKING']` → `'connected'`.
  (2) `WAHA_STATUS_MAP['SCAN_QR_CODE']` → `'qr_pending'`.
  (3) `WAHA_STATUS_MAP['FAILED']` → `'error'`.
  (4) `WAHA_STATUS_MAP['STARTING']` → `'disconnected'`.
  (5) `WAHA_STATUS_MAP['STOPPED']` → `'disconnected'`.
  (6) `WahaClient` times out after 10 seconds and throws `WAHA_TIMEOUT`.
  (7) `WahaClient` error messages do not contain the WAHA API key or HMAC secret values.

- [ ] T041 Create integration tests for the webhook route in `tests/integration/webhooks/waha-webhook.integration.test.ts`. Test using simulated HTTP requests (create a `Request` object, call the `POST` handler directly). Test cases:
  (1) Valid HMAC + allowed IP + `session.status` event → returns 200.
  (2) Invalid HMAC → returns 401.
  (3) Invalid HMAC + malformed JSON body → still returns 401 (proves HMAC validation happens before JSON parsing).
  (4) Valid HMAC + disallowed IP → returns 401.
  (5) Missing HMAC header → returns 401.
  (6) Valid HMAC + unknown session name → returns 200 (graceful discard).
  (7) Valid HMAC + paused/disabled `message` event → returns 200 and sends the fixed unavailability reply without AI processing.
  (8) Valid HMAC + unsupported non-text `message` event → returns 200 and sends the fixed `TEXT_ONLY_REPLY`.
  Need to set env vars for test (HMAC secret, allowed IPs) and mock WAHA sendText where appropriate.

- [ ] T042 Run full validation suite: `pnpm typecheck && pnpm lint && pnpm build`. Fix any errors. All three commands must pass with zero errors. Do not proceed to T043 until all pass.

- [ ] T043 Update `.env.example` to include all WAHA-related environment variables with descriptive comments: `WAHA_BASE_URL`, `WAHA_ADMIN_API_KEY`, `WAHA_WEBHOOK_HMAC_SECRET`, `WAHA_ALLOWED_IPS`, `ENABLE_WAHA_SANDBOX`.

- [ ] T044 Create the implementation handover document at `docs/waha-workspace-status-implementation-handover.md`. Follow the format established by `docs/project-foundation-implementation-handover.md` and `docs/database-setup-implementation-handover.md`. Include: overview, scope, source files modified/created, phase-by-phase summary, task-to-code mapping, collections/data used (no changes), routes/actions/services, core business logic, auth/tenant/security rules, external integrations, tests performed, issues found and fixed, remaining limitations, final status.

- [ ] T045 Run the quickstart validation from `specs/003-waha-workspace-status/quickstart.md`. Execute each validation step. Record results. Update the spec status from `Draft` to `Implemented` in `specs/003-waha-workspace-status/spec.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user stories
- **Phase 3 (US4 Webhook Security)**: Depends on Phase 2 — the webhook route needs env + types
- **Phase 4 (US1 Provisioning)**: Depends on Phase 2 + Phase 3 (webhook must be live for events)
- **Phase 5 (US2 QR Refresh)**: Depends on Phase 4 (session must exist to refresh)
- **Phase 6 (US3 Status Gate)**: Depends on Phase 2 only (independent of US1/US2)
- **Phase 7 (US5 State Persistence)**: Depends on Phase 3 + Phase 4 (webhook + service)
- **Phase 8 (US7 Locale Replies)**: Depends on Phase 6 (extends WorkspacesService)
- **Phase 9 (US6 Dashboard Widget)**: Depends on Phase 4 (needs WhatsApp service)
- **Phase 10 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US4 (Webhook Security)**: Can start after Phase 2 — no dependency on other stories
- **US1 (Provisioning)**: Can start after Phase 2 + US4
- **US2 (QR Refresh)**: Depends on US1
- **US3 (Status Gate)**: Can start after Phase 2 — independent of US1/US2/US4
- **US5 (State Persistence)**: Depends on US4 + US1
- **US6 (Dashboard Widget)**: Depends on US1
- **US7 (Locale Replies)**: Depends on US3

### Within Each User Story

- Types/constants before services
- Services before actions
- Actions before UI components
- UI components before route pages

### Parallel Opportunities

- T001, T002, T003 can all run in parallel (Phase 1 — different files)
- T007, T008 can run in parallel (Phase 3 — types and constants)
- T023, T024 can run in parallel (Phase 6 — types and constants)
- T035, T036, T037, T038, T039, T040 can all run in parallel (different test files)

---

## Parallel Example: Phase 1

```bash
# All Phase 1 tasks can run in parallel:
Task T001: "Create SupportedLocale type in src/shared/types/locale.ts"
Task T002: "Create locale detection in src/shared/lib/locale-from-text.ts"
Task T003: "Create system replies in src/shared/lib/system-replies.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 4 + 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T006)
3. Complete Phase 3: US4 Webhook Security (T007–T010)
4. Complete Phase 4: US1 Provisioning (T011–T021)
5. **STOP and VALIDATE**: Test provision → QR → connect → disconnect flow. Verify webhook rejects invalid requests.
6. Deploy/demo if ready — this is the MVP.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US4 (Webhook Security) → Webhook route is live and secure
3. Add US1 (Provisioning) → Owner can connect WhatsApp (MVP!)
4. Add US2 (QR Refresh) → Better UX
5. Add US3 (Status Gate) → Safety control
6. Add US5 (State Persistence) → Real-time dashboard
7. Add US7 (Locale Replies) → Localized experience
8. Add US6 (Dashboard Widget) → At-a-glance status
9. Polish → Tests, docs, validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **CRITICAL**: For ALL tasks that touch Payload code, the implementing model MUST read `.agents/skills/payload/SKILL.md` and `.agents/skills/payload/reference/` BEFORE writing code. Do not guess Payload API behavior from memory.
- **CRITICAL**: For ALL tasks that touch WAHA API calls, the implementing model MUST read `.agents/skills/WAHA/SKILL.md` AND search the web for current WAHA API documentation before implementing.
- **CRITICAL**: Follow the approved constitution at `.specify/memory/constitution.md`, the feature template at `.specify/memory/standards/feature-template.md`, and the module template at `.specify/memory/standards/module-template.md` for all new code.
