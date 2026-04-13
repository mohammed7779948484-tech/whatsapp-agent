---
name: WAHA (WhatsApp HTTP API)
description: Use when integrating or operating WAHA (WhatsApp HTTP API) for session lifecycle, QR flows, messaging, and webhook security. Always verify current WAHA docs / Swagger before implementing because some guides and engine matrices can differ.
---

# WAHA Skill

This skill captures the practical integration rules for **WAHA (WhatsApp HTTP API)** used in this repository.

## What to verify before writing code

1. **Check the current WAHA docs / Swagger for the pinned image**.
   - WAHA docs are mostly stable, but some pages can differ on exact endpoint/method presentation.
   - Treat the docs + Swagger for your deployed WAHA image as the source of truth.
2. **Do not guess webhook or QR response shapes from memory**.
3. **Do not assume QR data is embedded in `session.status` payloads**.
   - When WAHA emits `SCAN_QR_CODE`, fetch the updated QR explicitly.

## Core Concepts

### 1. Authentication
- WAHA commonly uses an API key header:
  - `X-Api-Key: YOUR_API_KEY`
- Do not leak the API key in logs or browser-visible errors.

### 2. Session Lifecycle
Common operations from the current docs:
- **Create session**: `POST /api/sessions`
- **Get session**: `GET /api/sessions/{session}`
- **Delete session**: `DELETE /api/sessions/{session}`

Recommended session naming for this project:
- `workspace_${workspaceId}`

### 3. QR Flow
Current docs describe QR retrieval like this:
- **Binary image**: `GET /api/{session}/auth/qr?format=image`
- **Base64 JSON**: `GET /api/{session}/auth/qr?format=image` with `Accept: application/json`
  - Response shape:
    ```json
    {
      "mimetype": "image/png",
      "data": "base64-encoded-data"
    }
    ```
- **Raw QR payload**: `GET /api/{session}/auth/qr?format=raw`
  - Response shape:
    ```json
    {
      "value": "value-that-you-need-to-use-to-generate-qr-code"
    }
    ```

For this repository, the intended pattern is:
- fetch the **base64 JSON** image form
- store/use the `data` field as the QR image payload
- render it in the UI as `data:image/png;base64,...`

### 4. Session Status Events
Important status values used by the project:
- `STARTING`
- `SCAN_QR_CODE`
- `WORKING`
- `FAILED`
- `STOPPED`

Critical rule from the docs:
- Every time you receive `session.status` with `SCAN_QR_CODE`, **fetch the updated QR** from `/api/{session}/auth/qr...` because the QR changes.

### 5. Messaging
- **Send text**: `POST /api/sendText`
  - Typical body:
    ```json
    {
      "session": "workspace_123",
      "chatId": "12132132130@c.us",
      "text": "Hi there!"
    }
    ```
- Incoming message payloads commonly include fields like:
  - `id`
  - `from`
  - `body`
  - `timestamp`
  - `hasMedia`
  - `media`
  - `fromMe`

Do **not** rely on a loosely documented `type` field alone for message support decisions.
Prefer checking whether the incoming payload contains a usable text body and whether media is present.

### 6. Webhooks and HMAC
WAHA webhook security uses:
- `X-Webhook-Hmac`
- `X-Webhook-Hmac-Algorithm`

Current docs specify:
- `X-Webhook-Hmac-Algorithm: sha512`
- HMAC is computed from the **raw HTTP request body** using the configured shared secret.

Webhook configuration is typically passed during session creation:
```json
{
  "name": "workspace_123",
  "config": {
    "webhooks": [
      {
        "url": "https://your-app.example.com/api/webhooks/waha",
        "events": ["session.status", "message"],
        "hmac": {
          "key": "your-secret-key"
        }
      }
    ]
  }
}
```

## Recommended Implementation Rules for This Repo

1. **Use `sha512` for WAHA webhook HMAC verification**.
2. **Validate HMAC on the raw body before JSON parsing**.
3. **Validate caller IP against an allowlist unless sandbox mode is enabled**.
4. **For `session.status: SCAN_QR_CODE`, fetch QR explicitly from WAHA**.
5. **For owner-facing Payload local API operations, do not bypass access rules unless there is a deliberate system-level reason**.
6. **Treat session lifecycle paths and owner dashboard actions differently**:
   - owner-facing Server Actions should respect user access control
   - trusted webhook/system paths may intentionally use system-level access where justified

## Example (fetch-based client)

```typescript
async function sendText(baseUrl: string, apiKey: string, session: string, chatId: string, text: string) {
  const response = await fetch(`${baseUrl}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session, chatId, text }),
  })

  if (!response.ok) {
    throw new Error(`WAHA sendText failed with status ${response.status}`)
  }
}
```

## Best Practices

1. **Always compare webhook HMAC with timing-safe comparison**.
2. **Do not parse JSON before HMAC validation**.
3. **Do not trust stale local session records** — verify remote session existence when needed.
4. **Normalize phone / chat identifiers deliberately** — do not mix raw `@c.us` IDs with stripped numbers without a rule.
5. **Never assume docs examples are exhaustive** — verify the exact response shape from Swagger for the deployed WAHA image.
6. **Secure WAHA with an API key and do not expose Swagger publicly without protection**.
