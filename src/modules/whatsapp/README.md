# WhatsApp Module

## Purpose
Encapsulates the WAHA gateway integration and owner-scoped session management logic for
workspace WhatsApp provisioning, QR retrieval, disconnect flows, and webhook validation.

## Consumers
| Feature/Layer | Usage |
|---|---|
| `features/whatsapp-connection` | Provision, load, and disconnect the workspace session |
| `app/api/webhooks/waha` | Validate inbound WAHA webhook traffic and parse events |

## Public API
| Export | Type | Description |
|---|---|---|
| `WhatsAppService` | Class | Owner-facing session lifecycle service |
| `validateHmac` | Function | Validates WAHA webhook signatures |
| `validateIpAllowlist` | Function | Validates WAHA source IP against allowlist |
| `extractClientIp` | Function | Extracts the leftmost forwarded IP |
| `WahaWebhookPayload` | Type | WAHA webhook envelope |
| `ProviderStatus` | Type | UI/session status union matching Payload data |

## Dependencies
- `core/providers/waha-client` - raw WAHA HTTP access
- `core/env` - runtime WAHA configuration
- `core/errors` - typed application errors
- `core/logger` - service diagnostics
- `payload/lib` - Payload Local API access

## Notes
- Owner-facing WhatsApp Connection actions must use verified Server Actions plus narrowly scoped
  trusted server-side persistence for the already resolved workspace session.
- Direct browser/API create/update/delete access to `whatsapp_sessions` remains admin-only.
