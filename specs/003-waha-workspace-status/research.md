# Research: WAHA Integration and Workspace Status Gate

**Branch**: `003-waha-workspace-status` | **Date**: 2026-04-05

---

## R-001: WAHA REST API Contract

**Decision**: Use WAHA's documented REST API with the following endpoints:

| Operation | Endpoint | Method |
|---|---|---|
| Create session | `POST /api/sessions` | POST |
| Get session status | `GET /api/sessions/{session}` | GET |
| Delete session | `DELETE /api/sessions/{session}` | DELETE |
| Get QR code (base64 image) | `GET /api/{session}/auth/qr?format=image` + `Accept: application/json` | GET* |
| Get QR code (raw payload) | `GET /api/{session}/auth/qr?format=raw` | GET |
| Send text message | `POST /api/sendText` | POST |

**Rationale**: These are the documented WAHA core endpoints. The session creation endpoint accepts webhook configuration inline, so our provisioning service can pass the Vercel webhook URL and HMAC secret at creation time.

**Alternatives considered**:
- Building a custom abstraction layer on top of WAHA — rejected (unnecessary complexity for the direct REST integration the constitution requires)
- Using WAHA's built-in dashboard — rejected (we need programmatic control)

---

## R-002: WAHA Webhook Event Types

**Decision**: Handle these WAHA webhook event types:

| Event | Action in Phase 3 |
|---|---|
| `session.status` | Update `provider_status`, `qr_code`, `connected_phone`, `last_synced_at` on the `whatsapp_sessions` record |
| `message` | Run synchronous security checks and lightweight routing. In Phase 3: send `UNAVAILABLE_REPLY` for paused/disabled workspaces, send `TEXT_ONLY_REPLY` for unsupported non-text messages, otherwise acknowledge with `200 OK` and defer AI processing to Phase 5 |

**Rationale**: WAHA sends `session.status` events for all session lifecycle changes (QR ready, connected, disconnected, failed). The `message` event carries inbound WhatsApp messages. Full AI message processing remains Phase 5, but Phase 3 still performs lightweight webhook routing so paused/disabled workspaces and unsupported non-text messages receive the correct fixed system replies immediately.

**WAHA session status values**: `STARTING`, `SCAN_QR_CODE`, `WORKING`, `FAILED`, `STOPPED`

**Mapping to `provider_status` field**:

| WAHA Status | `provider_status` value |
|---|---|
| `STARTING` | `disconnected` |
| `SCAN_QR_CODE` | `qr_pending` |
| `WORKING` | `connected` |
| `FAILED` | `error` |
| `STOPPED` | `disconnected` |

---

## R-003: WAHA HMAC Webhook Verification

**Decision**: Verify WAHA webhook authenticity using the `X-Webhook-Hmac` header with the documented `sha512` algorithm. Also honor `X-Webhook-Hmac-Algorithm` when present.

**Rationale**: Current WAHA webhook docs specify `X-Webhook-Hmac-Algorithm: sha512`. The server computes HMAC-SHA512 of the raw request body using the shared secret and compares it to the `X-Webhook-Hmac` header value. This is the WAHA-native approach.

**Implementation approach**:
1. Read raw request body as string
2. Check `X-Webhook-Hmac-Algorithm` when present — expect `sha512`
3. Compute HMAC-SHA512 using `WAHA_WEBHOOK_HMAC_SECRET`
4. Compare against `X-Webhook-Hmac` header using timing-safe comparison
5. Additionally check caller IP against `WAHA_ALLOWED_IPS` allowlist
6. Reject request if either check fails

**Alternatives considered**:
- Static API key header only — rejected (weaker, constitutional Article VIII requires HMAC + IP)
- Asymmetric signature (JWT) — rejected (not supported by WAHA)

---

## R-004: QR Code Display Format

**Decision**: Retrieve QR code as a base64-encoded image by sending `Accept: application/json` to `GET /api/{session}/auth/qr?format=image`. Store only the `data` field (base64 image payload) in `whatsapp_sessions.qr_code`. Use `?format=raw` only if the product later chooses client-side QR generation.

**Rationale**: Base64 image JSON can be rendered directly in the browser via `<img src="data:image/png;base64,...">` without additional infrastructure. This avoids needing to store QR images in R2 for a transient display need. The raw `{ value }` payload is a different WAHA response shape and should not be mixed with the image response.

**Alternatives considered**:
- Raw QR string + client-side QR rendering — rejected (adds client dependency on a QR library)
- Binary image stored in R2 — rejected (QR codes are transient and small, unnecessary storage overhead)

---

## R-005: WAHA Provider Client Timeout

**Decision**: All outbound HTTP calls from the WAHA provider client enforce a 10-second timeout using `AbortController` with `setTimeout`. No automatic retry is performed. On timeout, a descriptive error is returned to the caller.

**Rationale**: Clarified during the spec clarification session. Aligns with MVP simplicity and avoids hidden retry complexity on Vercel serverless.

---

## R-006: Locale Detection Approach

**Decision**: Use Unicode script detection to distinguish Arabic from English text. Check the proportion of Arabic Unicode characters (U+0600–U+06FF range) in the text. If ≥ 30% of alphabetic characters are Arabic, classify as Arabic. Otherwise classify as English. Default to Arabic when ambiguous or empty.

**Rationale**: Simple, dependency-free heuristic. In the target market (Saudi Arabia, Middle East), the two languages are visually distinct in Unicode representation. No external NLP API is needed for v1.

**Alternatives considered**:
- External language detection API — rejected (adds external dependency, latency, cost)
- Full Unicode CLDR detection — rejected (overengineered for two-language detection)

---

## R-007: Workspace Status Gate Architecture

**Decision**: The workspace status gate is a pure service function in `src/modules/workspaces/services/workspaces.service.ts`. It loads the workspace by ID, checks `status`, and returns a gate result indicating whether to proceed or reply with the locale-aware unavailability message. The gate does NOT send the reply itself — the caller (webhook handler or job consumer) is responsible for acting on the result. Unsupported non-text replies are handled by the webhook route after the gate passes.

**Rationale**: Keeping the gate as a pure decision function makes it testable independently and reusable across the webhook route (Phase 3) and the message processing job (Phase 5).

---

## R-008: Session Provisioning with Webhook Configuration

**Decision**: When creating a WAHA session via `POST /api/sessions`, include the webhook configuration inline so WAHA delivers events to our webhook URL automatically.

```json
{
  "name": "workspace_${workspaceId}",
  "config": {
    "webhooks": [
      {
        "url": "${APP_URL}/api/webhooks/waha",
        "events": ["session.status", "message"],
        "hmac": {
          "key": "${WAHA_WEBHOOK_HMAC_SECRET}"
        }
      }
    ]
  }
}
```

**Rationale**: WAHA supports per-session webhook configuration at creation time. This avoids a separate webhook registration step and ensures each session delivers events correctly.

---

## R-009: IP Allowlist Implementation

**Decision**: Extract the caller IP from the `x-forwarded-for` header (standard for Vercel / proxy deployments). Compare the leftmost IP against `WAHA_ALLOWED_IPS`. If the header is absent, treat the client IP as `unknown`.

**Rationale**: Vercel sits behind a reverse proxy, so the real client IP is in `x-forwarded-for`. The leftmost IP in the header chain is the client IP. If the allowlist is empty, skip the IP check only when `ENABLE_WAHA_SANDBOX` is true.

**Security note**: In production, `WAHA_ALLOWED_IPS` must always contain at least one IP. The `ENABLE_WAHA_SANDBOX` flag allows disabling IP checks in development only.
