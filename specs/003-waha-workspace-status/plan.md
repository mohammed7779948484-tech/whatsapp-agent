# Implementation Plan: WAHA Integration and Workspace Status Gate

**Branch**: `003-waha-workspace-status` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-waha-workspace-status/spec.md`

## Summary

Phase 3 bridges the data layer (Spec 2) to the external WAHA WhatsApp gateway. It introduces the WAHA provider client, session management services, webhook security (HMAC + IP), the workspace status gate, locale-aware system replies, and customer-facing WhatsApp Connection UI. No collection schema changes are needed — all collections exist from Spec 2. Direct browser/API create/update/delete access to `whatsapp_sessions` remains admin-only. Owner-facing WhatsApp Connection actions are implemented instead through verified Server Actions plus narrowly scoped trusted server-side persistence for the single workspace session.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 16.2.x, Node.js 22  
**Primary Dependencies**: Payload CMS 3.79.1, WAHA REST API, `crypto` (Node.js built-in for HMAC)  
**Storage**: Neon PostgreSQL (existing), Cloudflare R2 (existing)  
**Testing**: Vitest (unit + integration)  
**Target Platform**: Vercel (serverless), WAHA on separate VPS  
**Project Type**: Web service (SaaS dashboard)  
**Performance Goals**: 10s timeout on WAHA API calls, < 2s webhook event persistence, QR refresh < 5s  
**Constraints**: No automatic retry on WAHA API failures, HMAC + IP validation mandatory  
**Scale/Scope**: Single tenant per workspace, one WAHA session per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|---|---|---|
| Article IV — Tenant isolation | ✅ PASS | All Server Actions verify owner session → workspace. Module services receive `tenantId` from session, not client. Owner-scoped reads use authenticated user context. Direct collection writes for `whatsapp_sessions` remain closed to owners; the narrow write path is mediated server-side for the already verified workspace session only. |
| Article V — Serverless-first | ✅ PASS | Webhook handler is a Next.js route handler. No background workers. 10s timeout on outbound calls fits serverless constraints. |
| Article VI — Feature/module template compliance | ✅ PASS | WhatsApp Connection feature follows `feature-template.md`. WAHA module follows `module-template.md`. Workspaces module follows `module-template.md`. |
| Article VII — No custom ORMs or abstraction layers | ✅ PASS | Uses Payload Local API directly. Raw `fetch` for WAHA REST calls. |
| Article VIII — Webhook security | ✅ PASS | HMAC-SHA512 + IP allowlist, both checked before any data processing. |
| Article IX — Locale rules | ✅ PASS | Arabic default, agent `language_preference` override, Unicode script detection fallback. |
| Article X — MVP scope | ✅ PASS | No extra features beyond the master plan Phase 3 tasks. |

**Post-design re-check**: All gates remain PASS after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/003-waha-workspace-status/
├── plan.md                  # This file
├── spec.md                  # Feature specification
├── research.md              # Phase 0 research
├── data-model.md            # Data model (no schema changes)
├── quickstart.md            # Validation guide
├── checklists/
│   └── requirements.md      # Quality checklist
├── contracts/
│   ├── waha-webhook.md      # Webhook route contract
│   └── whatsapp-connection-actions.md  # Server Action contracts
└── tasks.md                 # Task breakdown (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── modules/
│   ├── whatsapp/                          # [NEW] WAHA module
│   │   ├── README.md
│   │   ├── index.ts
│   │   ├── services/
│   │   │   └── whatsapp.service.ts        # Session CRUD, state updates
│   │   ├── validators/
│   │   │   └── validate-waha-webhook.ts   # HMAC + IP validation
│   │   ├── types.ts                       # WahaWebhookEvent, WahaSessionStatus, etc.
│   │   └── constants.ts                   # Status mappings, event types
│   └── workspaces/                        # [NEW] Workspaces module
│       ├── README.md
│       ├── index.ts
│       ├── services/
│       │   └── workspaces.service.ts      # Workspace status gate
│       ├── validators/
│       │   └── validate-workspace-status.ts
│       ├── types.ts
│       └── constants.ts
├── features/
│   └── whatsapp-connection/               # [NEW] WhatsApp Connection feature
│       ├── README.md
│       ├── feature.config.ts
│       ├── index.ts
│       ├── ui/
│       │   ├── WhatsAppConnectionPage.tsx  # Server Component page
│       │   └── _components/
│       │       ├── WhatsAppQrCard.tsx       # QR display + refresh
│       │       └── WhatsAppSessionStatus.tsx # Status indicator
│       ├── actions/
│       │   ├── provision-whatsapp-session.action.ts
│       │   ├── refresh-whatsapp-qr.action.ts
│       │   └── disconnect-whatsapp-session.action.ts
│       ├── types.ts
│       └── constants.ts
├── core/
│   ├── providers/
│   │   └── waha-client.ts                 # [NEW] Low-level WAHA HTTP client
│   ├── env.ts                             # [MODIFY] Promote WAHA vars to required
│   └── errors/
│       └── error-codes.ts                 # [MODIFY] Add WAHA/session-specific error codes
├── shared/
│   ├── lib/
│   │   ├── locale-from-text.ts            # [NEW] Arabic/English detection
│   │   └── system-replies.ts              # [NEW] Fixed locale-aware replies
│   └── types/
│       └── locale.ts                      # [NEW] SupportedLocale type
├── payload/
│   └── collections/
│       └── whatsapp-sessions.collection.ts # [NO CHANGE] direct owner writes remain admin-only
├── app/
│   ├── (frontend)/
│   │   └── (dashboard)/
│   │       ├── whatsapp/
│   │       │   └── page.tsx               # [NEW] WhatsApp connection page
│   │       └── dashboard/
│   │           └── page.tsx               # [MODIFY] Add connection widget
│   └── api/
│       └── webhooks/
│           └── waha/
│               └── route.ts              # [MODIFY] Replace 501 placeholder

tests/
├── unit/
│   ├── modules/
│   │   ├── whatsapp/
│   │   │   ├── validate-waha-webhook.test.ts
│   │   │   ├── whatsapp.service.test.ts
│   │   │   └── waha-client.test.ts
│   │   └── workspaces/
│   │       └── workspaces.service.test.ts
│   └── shared/
│       ├── locale-from-text.test.ts
│       └── system-replies.test.ts
└── integration/
    └── webhooks/
        └── waha-webhook.integration.test.ts
```

**Structure Decision**: Follows the existing project structure from Specs 1 and 2. New code is placed in the approved `modules/`, `features/`, `core/providers/`, and `shared/` directories per the constitution and master plan tree.

## Implementation Phases

### Phase 1 — Shared Infrastructure (No UI)

Build order: types → constants → providers → validators → services

1. Create `src/shared/types/locale.ts` (`SupportedLocale`, `DEFAULT_LOCALE`)
2. Create `src/shared/lib/locale-from-text.ts` (Unicode script detection)
3. Create `src/shared/lib/system-replies.ts` (Arabic/English fixed replies)
4. Create `src/core/providers/waha-client.ts` (HTTP client with 10s timeout, auth header)
5. Promote WAHA env vars in `src/core/env.ts` from optional to required-when-not-sandbox
6. Extend `src/core/errors/error-codes.ts` with WAHA/session-specific error codes used by this phase

### Phase 2 — WAHA Module

1. Create `src/modules/whatsapp/types.ts`
2. Create `src/modules/whatsapp/constants.ts` (status mapping, event types)
3. Create `src/modules/whatsapp/validators/validate-waha-webhook.ts` (HMAC + IP)
4. Create `src/modules/whatsapp/services/whatsapp.service.ts`:
   - `provisionSession(workspaceId, payload, user)`
   - `getSessionForWorkspace(workspaceId, payload, user)`
   - `refreshQrCode(workspaceId, payload, user)`
   - `disconnectSession(workspaceId, payload, user)`
   - `resolveWorkspaceIdFromSessionName(sessionName)`
   - `updateSessionState(sessionName, status, data, payload)`
5. Keep direct `whatsapp_sessions` collection writes admin-only; owner-facing actions will instead use verified Server Actions plus narrowly scoped trusted server-side persistence for the resolved workspace session
6. Create `src/modules/whatsapp/index.ts` and `README.md`

### Phase 3 — Workspaces Module

1. Create `src/modules/workspaces/types.ts`
2. Create `src/modules/workspaces/constants.ts`
3. Create `src/modules/workspaces/validators/validate-workspace-status.ts`
4. Create `src/modules/workspaces/services/workspaces.service.ts`:
   - `checkStatusGate(workspaceId, payload, inboundText)` → returns gate result
   - `getWorkspaceForOwner(workspaceId, payload, user)`
5. Create `src/modules/workspaces/index.ts` and `README.md`

### Phase 4 — Webhook Route

1. Replace `src/app/api/webhooks/waha/route.ts` placeholder:
   - HMAC validation → IP validation → parse event → route event
   - `session.status` → call `whatsapp.service.updateSessionState()`
   - `message` → resolve workspace → run status gate → send fixed reply for paused/disabled or unsupported messages → otherwise acknowledge 200 OK and defer AI processing to Phase 5
   - unknown session → log + discard

### Phase 5 — WhatsApp Connection Feature

1. Create feature scaffold: `README.md`, `feature.config.ts`, `index.ts`, `types.ts`, `constants.ts`
2. Create Server Actions:
   - `provision-whatsapp-session.action.ts`
   - `refresh-whatsapp-qr.action.ts`
   - `disconnect-whatsapp-session.action.ts`
3. Create UI components:
   - `WhatsAppSessionStatus.tsx` (status indicator)
   - `WhatsAppQrCard.tsx` (QR image + refresh button)
   - `WhatsAppConnectionPage.tsx` (main page)
4. Create route: `src/app/(frontend)/(dashboard)/whatsapp/page.tsx`
5. Register feature in `src/features/_registry/index.ts`
6. Add a presentational dashboard widget that receives preloaded session data as props (no module imports inside `widgets/`)

### Phase 6 — Dashboard Widget

1. Create connection summary widget component
2. Integrate into `src/app/(frontend)/(dashboard)/dashboard/page.tsx`

### Phase 7 — Tests

1. Unit tests for HMAC validation
2. Unit tests for IP allowlist
3. Unit tests for workspace status gate
4. Unit tests for locale detection
5. Unit tests for system reply selection
6. Unit tests for WAHA status mapping
7. Integration tests for webhook route
8. Integration tests for Server Actions (if test DB available)

### Phase 8 — Polish and Verification

1. Run full validation suite from quickstart.md
2. Verify `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
3. Create handover document

## Complexity Tracking

No constitution violations. No complexity justifications needed.
