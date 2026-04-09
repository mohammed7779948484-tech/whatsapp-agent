# Contract: WAHA Webhook Route

**Endpoint**: `POST /api/webhooks/waha`  
**Source**: WAHA gateway (external)  
**Replaces**: Current `501 Not Implemented` placeholder

---

## Request

### Headers

| Header | Required | Description |
|---|---|---|
| `X-Webhook-Hmac` | ✅ | HMAC-SHA512 hex digest of the raw request body, computed using the shared secret |
| `X-Webhook-Hmac-Algorithm` | ❌ | Algorithm used (expected: `sha512` when present) |
| `Content-Type` | ✅ | `application/json` |
| `X-Forwarded-For` | ✅ (Vercel) | Client IP address chain |

### Body: Session Status Event

```json
{
  "event": "session.status",
  "session": "workspace_123",
  "payload": {
    "status": "WORKING"
  },
  "me": {
    "id": "966500000001@c.us",
    "pushName": "Store Name"
  }
}
```

Status values: `STARTING`, `SCAN_QR_CODE`, `WORKING`, `FAILED`, `STOPPED`

When status is `SCAN_QR_CODE`, the implementation must fetch the updated QR from WAHA (for this spec, use the base64 image response from `GET /api/{session}/auth/qr?format=image` with `Accept: application/json`). Do not assume the webhook body itself contains the QR image bytes.

### Body: Message Event

```json
{
  "event": "message",
  "session": "workspace_123",
  "payload": {
    "id": "true_966500000001@c.us_ABCDEF",
    "from": "966500000001@c.us",
    "body": "Hello, what are your prices?",
    "hasMedia": false,
    "timestamp": 1714500000
  }
}
```

---

## Response

### Success

```
HTTP 200 OK
Content-Type: application/json

{ "status": "ok" }
```

### Validation Failure (HMAC or IP)

```
HTTP 401 Unauthorized
Content-Type: application/json

{ "error": "Unauthorized" }
```

### Unknown Session

```
HTTP 200 OK
Content-Type: application/json

{ "status": "ok", "note": "unknown session, event discarded" }
```

Returns 200 to prevent WAHA from retrying events for deleted/unknown sessions.

---

## Processing Rules

1. Validate HMAC signature (timing-safe comparison)
2. Validate caller IP against allowlist
3. Parse event type from body
4. Route by event type:
   - `session.status` → update `whatsapp_sessions` record
   - `message` → resolve workspace → run workspace status gate → send `UNAVAILABLE_REPLY` when paused/disabled → send `TEXT_ONLY_REPLY` for unsupported non-text messages → otherwise acknowledge and defer AI processing to Phase 5
   - all other events → acknowledge and discard
5. All processing is synchronous within the request — no QStash publish in Phase 3
