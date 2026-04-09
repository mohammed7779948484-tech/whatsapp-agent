# Data Model: WAHA Integration and Workspace Status Gate

**Branch**: `003-waha-workspace-status` | **Date**: 2026-04-05

---

## Existing Entities (No Schema Changes)

Phase 3 uses existing Payload collections created in Spec 2. **No schema modifications** are needed.

### `whatsapp_sessions` (existing)

| Field | Type | Required | Source |
|---|---|---|---|
| `workspace` | relationship → `workspaces` | ✅ | Spec 2 |
| `session_name` | text | ✅ | Spec 2 |
| `provider_status` | select: `connected`, `disconnected`, `qr_pending`, `error` | ✅ (default: `disconnected`) | Spec 2 |
| `qr_code` | textarea | ❌ | Spec 2 |
| `connected_phone` | text | ❌ | Spec 2 |
| `last_synced_at` | date | ❌ | Spec 2 |
| `last_error` | textarea | ❌ | Spec 2 |

**Invariant**: One session per workspace (enforced by `enforceOnePerWorkspace` hook from Spec 2).

**Phase 3 write-path decision**: direct browser/API create/update/delete access to `whatsapp_sessions` remains admin-only. Owner-facing WhatsApp Connection actions still exist, but they are implemented through verified Server Actions plus narrowly scoped server-side service methods that read the current workspace session via authenticated owner context and then perform trusted persistence only for that same verified workspace. This is an implementation constraint — not a schema change.

**State transitions** (driven by WAHA webhook events):

```text
(no session) → disconnected → qr_pending → connected → disconnected
                    ↑              ↑                         |
                    |              |                         |
                    +----- error ←-+-←-----------←----------+
```

### `workspaces` (existing)

Used for workspace status gate. Relevant fields:

| Field | Type | Relevant Values |
|---|---|---|
| `status` | select | `active`, `paused`, `disabled` |
| `owner` | relationship → `users` | Set in Spec 2 |

### `agents` (existing)

Used for locale resolution. Relevant field:

| Field | Type | Relevant Values |
|---|---|---|
| `language_preference` | select | `ar`, `en`, or null |

---

## New Types / Constants (Code-Level, Not Collections)

### Fixed System Reply Constants

Location: `src/shared/lib/system-replies.ts`

| Key | Arabic (`ar`) | English (`en`) |
|---|---|---|
| `UNAVAILABLE_REPLY` | عذرًا، الخدمة غير متوفرة حاليًا. يرجى المحاولة لاحقًا. | Sorry, the service is currently unavailable. Please try again later. |
| `TEXT_ONLY_REPLY` | عذرًا، نحن نقبل الرسائل النصية فقط في الوقت الحالي. | Sorry, we only accept text messages at this time. |
| `SAFE_FALLBACK_REPLY` | عذرًا، لا أملك معلومات كافية للإجابة على سؤالك. يرجى التواصل مع المتجر مباشرة. | Sorry, I don't have enough information to answer your question. Please contact the store directly. |

### Supported Locale Type

Location: `src/shared/types/locale.ts`

```text
type SupportedLocale = 'ar' | 'en'
DEFAULT_LOCALE = 'ar'
```

### WAHA Provider Status Mapping

Location: `src/modules/whatsapp/constants.ts`

| WAHA Status | Local `provider_status` |
|---|---|
| `STARTING` | `disconnected` |
| `SCAN_QR_CODE` | `qr_pending` |
| `WORKING` | `connected` |
| `FAILED` | `error` |
| `STOPPED` | `disconnected` |

### WAHA Webhook Event Type

Location: `src/modules/whatsapp/types.ts`

```text
WahaWebhookEvent = 'session.status' | 'message' | 'message.ack'
```

---

## Relationships Diagram

```text
workspace (1) ──── (1) whatsapp_session
     |
     └── (1) agent ── language_preference → locale resolution
     |
     └── status ── workspace status gate
```

---

## Validation Rules

1. Session name MUST follow pattern `workspace_${workspaceId}` — validated at provisioning time.
2. Workspace ID parsed from session name MUST resolve to an existing workspace — validated at webhook handling time.
3. HMAC signature MUST match computed value — validated before any event processing.
4. Caller IP MUST be in allowlist (unless sandbox mode) — validated before any event processing.
5. QR code content is transient. When using the base64 image response, store only the WAHA `data` field in `qr_code` (not the entire JSON object).
6. `SCAN_QR_CODE` does not imply QR bytes are embedded in the webhook event; the implementation fetches the updated QR from WAHA when needed.
